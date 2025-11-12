import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { verifyTOTP, hashCode } from "../_shared/totp.ts";
import { checkRateLimit, resetRateLimit } from "../_shared/rate-limit.ts";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { MfaChallengeResponse } from '../_shared/types.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('[MFA Challenge] Request received');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[MFA Challenge] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[MFA Challenge] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    // Rate limiting: Max 5 attempts per minute per user, 15-minute lockout on failure
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    const rateLimitKey = `mfa-challenge:${user.id}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60000, 900000); // 5 attempts, 1 min window, 15 min lockout

    if (!rateLimit.allowed) {
      if (rateLimit.isLocked) {
        const lockedMinutes = Math.ceil((rateLimit.lockedUntil! - Date.now()) / 60000);
        console.log(`[MFA Challenge] User ${user.id} is locked out for ${lockedMinutes} minutes`);
        
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

      return new Response(
        JSON.stringify({ 
          error: 'Too many attempts. Please try again later.',
          remaining: rateLimit.remaining
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MFA Challenge] User ${user.email} attempting verification (${rateLimit.remaining} attempts remaining)`);

    const body = await req.json();
    const { code, type = 'totp' } = body;
    
    console.log(`[MFA Challenge] Request body:`, { code: code ? '***' : 'missing', type });
    
    if (!code) {
      console.error('[MFA Challenge] Missing verification code');
      return new Response(
        JSON.stringify({ error: 'Missing verification code' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log(`[MFA Challenge] User ${user.email} attempting ${type} verification`);

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('totp_secret, totp_backup_codes, totp_enabled')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[MFA Challenge] Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log(`[MFA Challenge] Profile loaded, totp_enabled: ${profile?.totp_enabled}`);

    if (!profile?.totp_enabled) {
      console.error('[MFA Challenge] TOTP not enabled for user');
      return new Response(
        JSON.stringify({ error: 'Two-factor authentication is not enabled' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    let isValid = false;
    let usedRecoveryCode = false;

    if (type === 'totp' && code.length === 6) {
      // Verify TOTP code
      console.log(`[MFA Challenge] Verifying TOTP code length: ${code.length}`);
      if (!profile.totp_secret) {
        console.error('[MFA Challenge] No TOTP secret found');
        return new Response(
          JSON.stringify({ error: 'TOTP secret not configured' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      // Decrypt the secret before verification
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: decryptedSecret, error: decryptError } = await supabaseAdmin
        .rpc('decrypt_totp_secret', { encrypted_secret: profile.totp_secret });

      if (decryptError || !decryptedSecret) {
        console.error('[MFA Challenge] Decryption error:', decryptError);
        return new Response(
          JSON.stringify({ error: 'Failed to decrypt TOTP secret' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      isValid = await verifyTOTP(decryptedSecret, code);
      console.log(`[MFA Challenge] TOTP verification result: ${isValid}`);
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
        
        console.log(`[MFA Challenge] Recovery code used, ${newBackupCodes.length} remaining`);
      }
    }

    if (!isValid) {
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

      return new Response(
        JSON.stringify({ 
          error: 'Invalid verification code',
          remaining_attempts: rateLimit.remaining
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Success - reset rate limit
    resetRateLimit(rateLimitKey);
    console.log(`[MFA Challenge] Verification successful for ${user.email}`);

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

    return new Response(
      JSON.stringify({ 
        ok: true,
        valid_for_seconds: stepupWindow,
        recovery_code_used: usedRecoveryCode,
        remaining_attempts: rateLimit.remaining,
        message: 'Verification successful'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[MFA Challenge] Uncaught error:', error);
    console.error('[MFA Challenge] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    const message = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ 
        error: message,
        details: 'Internal server error occurred. Please try again.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
