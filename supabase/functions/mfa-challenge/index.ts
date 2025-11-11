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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
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

    const { code, type = 'totp' } = await req.json();
    if (!code) {
      throw new Error('Missing verification code');
    }

    console.log(`[MFA Challenge] User ${user.email} attempting ${type} verification`);

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_secret, totp_backup_codes, totp_enabled')
      .eq('id', user.id)
      .single();

    if (!profile?.totp_enabled) {
      throw new Error('Two-factor authentication is not enabled');
    }

    let isValid = false;
    let usedRecoveryCode = false;

    if (type === 'totp' && code.length === 6) {
      // Verify TOTP code
      isValid = await verifyTOTP(profile.totp_secret || '', code);
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

      throw new Error('Invalid verification code');
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
        message: 'Verification successful'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[MFA Challenge] Error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
