import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { verifyTOTP, hashCode } from "../_shared/totp.ts";
import { checkRateLimit, resetRateLimit } from "../_shared/rate-limit.ts";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { MfaChallengeResponse } from '../_shared/types.ts';
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { handleEnhancedError, ValidationError, AuthenticationError, RateLimitError } from '../_shared/enhanced-errors.ts';

serve(async (req) => {
  const logger = createLogger('mfa-challenge');
  
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    logger.logRequest(req);
    const requestContext = extractRequestContext(req);
    logger.setContext(requestContext);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.warn('Missing authorization header');
      throw new AuthenticationError('Authorization header required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.warn('Authentication failed', { error: userError?.message });
      throw new AuthenticationError('Invalid authentication token');
    }

    logger.setContext({ userId: user.id });
    logger.info('User authenticated', { email: user.email });

    // Rate limiting: Max 5 attempts per minute per user, 15-minute lockout on failure
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    const rateLimitKey = `mfa-challenge:${user.id}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60000, 900000); // 5 attempts, 1 min window, 15 min lockout

    logger.debug('Rate limit check', { 
      allowed: rateLimit.allowed,
      remaining: rateLimit.remaining,
      isLocked: rateLimit.isLocked
    });

    if (!rateLimit.allowed) {
      if (rateLimit.isLocked) {
        const lockedMinutes = Math.ceil((rateLimit.lockedUntil! - Date.now()) / 60000);
        logger.warn('Account locked due to too many MFA attempts', { 
          userId: user.id,
          lockedMinutes,
          lockedUntil: rateLimit.lockedUntil
        });
        
        // Log failed attempt due to lockout
        await supabase
          .from('audit_logs')
          .insert({
            actor_user_id: user.id,
            action: 'mfa.challenge.locked',
            target: `user:${user.id}`,
            tenant_id: null,
            ip: clientIp,
            user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
          });

        return new Response(
          JSON.stringify({ 
            error: `บัญชีถูกล็อกชั่วคราวเนื่องจากพยายามยืนยันตัวตนหลายครั้ง กรุณารอ ${lockedMinutes} นาที`,
            code: 'MFA_LOCKED',
            locked_until: new Date(rateLimit.lockedUntil!).toISOString(),
            remaining_minutes: lockedMinutes
          }),
          { 
            status: 429,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((rateLimit.lockedUntil! - Date.now()) / 1000))
            } 
          }
        );
      }

      logger.warn('Rate limit exceeded', { 
        userId: user.id,
        remaining: rateLimit.remaining 
      });
      throw new RateLimitError('Too many attempts. Please try again later.', { 
        remaining: rateLimit.remaining 
      });
    }

    logger.info('Rate limit check passed', { 
      remaining: rateLimit.remaining,
      email: user.email 
    });

    const body = await req.json();
    const { code, type = 'totp' } = body;
    
    logger.debug('Verification attempt', { 
      hasCode: !!code, 
      type,
      codeLength: code?.length 
    });
    
    if (!code) {
      logger.warn('Missing verification code');
      throw new ValidationError('Verification code is required');
    }

    logger.info('Starting MFA verification', { type, email: user.email });

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('totp_secret, totp_backup_codes, totp_enabled')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logger.error('Failed to fetch user profile', profileError);
      throw new Error('Failed to fetch user profile');
    }

    logger.debug('Profile loaded', { 
      totpEnabled: profile?.totp_enabled,
      hasBackupCodes: !!profile?.totp_backup_codes?.length
    });

    if (!profile?.totp_enabled) {
      logger.warn('TOTP not enabled for user', { userId: user.id });
      throw new ValidationError('Two-factor authentication is not enabled');
    }

    let isValid = false;
    let usedRecoveryCode = false;

    if (type === 'totp' && code.length === 6) {
      // Verify TOTP code
      logger.debug('Verifying TOTP code', { codeLength: code.length });
      
      if (!profile.totp_secret) {
        logger.error('TOTP secret not configured', { userId: user.id });
        throw new Error('TOTP secret not configured');
      }

      // Decrypt the secret before verification
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: decryptedSecret, error: decryptError } = await supabaseAdmin
        .rpc('decrypt_totp_secret', { encrypted_secret: profile.totp_secret });

      if (decryptError || !decryptedSecret) {
        logger.error('Failed to decrypt TOTP secret', decryptError);
        throw new Error('Failed to decrypt TOTP secret');
      }

      logger.debug('TOTP secret decrypted successfully');
      isValid = await verifyTOTP(decryptedSecret, code);
      logger.info('TOTP verification completed', { isValid });
    } else if (type === 'recovery' || code.includes('-')) {
      // Verify recovery code - hash and compare
      const cleanCode = code.toUpperCase().replace(/-/g, '');
      const hashedInput = await hashCode(cleanCode);
      const backupCodes = profile.totp_backup_codes || [];
      
      const codeIndex = backupCodes.indexOf(hashedInput);
      if (codeIndex !== -1) {
        isValid = true;
        usedRecoveryCode = true;
        
        // Remove used recovery code
        const newBackupCodes = backupCodes.filter((_: string, i: number) => i !== codeIndex);
        await supabase
          .from('profiles')
          .update({ totp_backup_codes: newBackupCodes })
          .eq('id', user.id);
        
        logger.info('Recovery code used', { 
          userId: user.id,
          remainingCodes: newBackupCodes.length 
        });
      }
    }

    if (!isValid) {
      logger.warn('Invalid verification code', { 
        userId: user.id,
        type,
        remainingAttempts: rateLimit.remaining 
      });

      // Create audit log for failed attempt
      await supabase
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          action: 'mfa.challenge.failed',
          target: `user:${user.id}`,
          tenant_id: null,
          ip: clientIp,
          user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
        });

      throw new ValidationError('Invalid verification code', { 
        remaining_attempts: rateLimit.remaining 
      });
    }

    // Success - reset rate limit
    resetRateLimit(rateLimitKey);
    logger.info('MFA verification successful', { 
      userId: user.id,
      email: user.email,
      type,
      usedRecoveryCode
    });

    // Get tenant policy to determine window
    const { data: membership } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let stepupWindow = 300; // Default 5 minutes
    if (membership?.tenant_id) {
      const { data: policy } = await supabase
        .from('tenant_security_policy')
        .select('stepup_window_seconds')
        .eq('tenant_id', membership.tenant_id)
        .single();
      
      if (policy) {
        stepupWindow = policy.stepup_window_seconds || 300;
      }
    }

    // Update last verified timestamp
    await supabase
      .from('profiles')
      .update({ mfa_last_verified_at: new Date().toISOString() })
      .eq('id', user.id);

    // Create audit log for successful verification
    await supabase
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        action: usedRecoveryCode ? 'mfa.challenge.recovery' : 'mfa.challenge.success',
        target: `user:${user.id}`,
        tenant_id: membership?.tenant_id || null,
        ip: clientIp,
        user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
      });

    logger.info('Audit log created');

    const responseData = { 
      ok: true,
      valid_for_seconds: stepupWindow,
      recovery_code_used: usedRecoveryCode,
      remaining_attempts: rateLimit.remaining,
      message: 'Verification successful'
    };

    logger.info('MFA challenge completed successfully', { 
      stepupWindow,
      recoveryCodeUsed: usedRecoveryCode,
      duration: logger.getDuration()
    });
    logger.logResponse(200, responseData);

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
