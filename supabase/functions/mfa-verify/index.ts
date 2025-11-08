import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { verifyTOTP, generateBackupCodes, hashCode } from "../_shared/totp.ts";
import { checkRateLimit, resetRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Rate limiting: Max 5 attempts per 5 minutes, 30-minute lockout
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    const rateLimitKey = `mfa-verify:${user.id}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 300000, 1800000); // 5 attempts, 5 min window, 30 min lockout

    if (!rateLimit.allowed) {
      if (rateLimit.isLocked) {
        const lockedMinutes = Math.ceil((rateLimit.lockedUntil! - Date.now()) / 60000);
        
        await supabase
          .from('audit_logs')
          .insert({
            actor_user_id: user.id,
            action: 'mfa.verify.locked',
            target: `user:${user.id}`,
            tenant_id: null,
            ip: clientIp,
            user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
          });

        return new Response(
          JSON.stringify({ 
            error: `พยายามยืนยันรหัสผิดหลายครั้ง บัญชีถูกล็อกชั่วคราว ${lockedMinutes} นาที`,
            code: 'MFA_VERIFY_LOCKED',
            locked_until: new Date(rateLimit.lockedUntil!).toISOString()
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
        JSON.stringify({ error: 'Too many verification attempts' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MFA Verify] User ${user.email} verifying 2FA (${rateLimit.remaining} attempts remaining)`);

    const { code } = await req.json();
    if (!code || code.length !== 6) {
      throw new Error('Invalid verification code');
    }

    // Get user's TOTP secret
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_secret')
      .eq('id', user.id)
      .single();

    if (!profile?.totp_secret) {
      throw new Error('TOTP secret not found. Please enroll first.');
    }

    console.log(`[MFA Verify] Secret length: ${profile.totp_secret.length}, First 4 chars: ${profile.totp_secret.substring(0, 4)}...`);

    // Verify the TOTP code
    const isValid = await verifyTOTP(profile.totp_secret, code);
    if (!isValid) {
      console.log(`[MFA Verify] Verification failed for ${user.email}`);
      // Log failed verification attempt
      await supabase
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          action: 'mfa.verify.failed',
          target: `user:${user.id}`,
          tenant_id: null,
          ip: clientIp,
          user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
        });

      throw new Error('Invalid verification code');
    }

    // Success - reset rate limit
    resetRateLimit(rateLimitKey);
    console.log(`[MFA Verify] Code verified for ${user.email}`);

    // Generate recovery codes
    const recoveryCodes = generateBackupCodes(10);
    const hashedCodes = await Promise.all(recoveryCodes.map(c => hashCode(c.replace(/-/g, ''))));

    // Enable 2FA and store recovery codes using RPC to bypass cache
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabaseAdmin.rpc('enable_totp_with_codes', {
      user_id: user.id,
      backup_codes: hashedCodes
    });

    if (updateError) {
      console.error('[MFA Verify] Error enabling 2FA:', updateError);
      throw updateError;
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        action: 'mfa.enabled',
        target: `user:${user.id}`,
        tenant_id: null,
        ip: clientIp,
        user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        recovery_codes: recoveryCodes,
        message: 'Two-factor authentication enabled successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[MFA Verify] Error:', error);
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
