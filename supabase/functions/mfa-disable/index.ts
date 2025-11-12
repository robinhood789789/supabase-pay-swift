import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { verifyTOTP, hashCode } from "../_shared/totp.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateString } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

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

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 5 disable attempts per hour per user
    const rateLimitResult = checkRateLimit(user.id, 5, 3600000); // 5 attempts, 1 hour window
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many MFA disable attempts. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    const { code, type = 'totp' } = await req.json();

    // Input validation
    const codeError = validateString('code', code, { 
      required: true,
      minLength: 4,
      maxLength: 12
    });
    if (codeError) {
      return new Response(
        JSON.stringify({ error: codeError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MFA Disable] User ${user.email} attempting to disable 2FA with ${type}`);

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

    if (type === 'totp' && code.length === 6) {
      // Decrypt the secret before verification
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: decryptedSecret, error: decryptError } = await supabaseAdmin
        .rpc('decrypt_totp_secret', { encrypted_secret: profile.totp_secret || '' });

      if (decryptError || !decryptedSecret) {
        console.error('[MFA Disable] Decryption error:', decryptError);
        throw new Error('Failed to decrypt TOTP secret');
      }

      // Verify TOTP code using decrypted secret
      isValid = await verifyTOTP(decryptedSecret, code);
    } else if (type === 'recovery' || code.includes('-')) {
      // Verify recovery code
      const cleanCode = code.toUpperCase().replace(/-/g, '');
      const hashedInput = await hashCode(cleanCode);
      const backupCodes = profile.totp_backup_codes || [];
      
      if (backupCodes.indexOf(hashedInput) !== -1) {
        isValid = true;
      }
    }

    if (!isValid) {
      // Create audit log for failed attempt
      await supabase
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          action: 'mfa.disable.failed',
          target: `user:${user.id}`,
          tenant_id: null,
          ip: clientIp,
          user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
        });

      throw new Error('Invalid verification code');
    }

    // Disable 2FA
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        totp_enabled: false,
        totp_secret: null,
        totp_backup_codes: null,
        mfa_last_verified_at: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[MFA Disable] Error updating profile:', updateError);
      throw updateError;
    }

    // Create audit log for successful disable
    await supabase
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        action: 'mfa.disabled',
        target: `user:${user.id}`,
        tenant_id: null,
        ip: clientIp,
        user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
      });

    return new Response(
      JSON.stringify({ 
        ok: true,
        message: 'Two-factor authentication disabled successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[MFA Disable] Error:', error);
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
