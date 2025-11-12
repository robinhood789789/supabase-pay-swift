import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { verifyTOTP, generateBackupCodes, hashCode } from "../_shared/totp.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateString } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { MfaVerifyRequest } from '../_shared/types.ts';

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 10 verification attempts per hour per user
    const rateLimitResult = checkRateLimit(user.id, 10, 3600000); // 10 attempts, 1 hour window
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many MFA verification attempts. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    const { code } = await req.json();

    // Input validation
    const tokenError = validateString('code', code, { 
      required: true, 
      minLength: 6, 
      maxLength: 6,
      pattern: /^\d{6}$/,
      patternMessage: 'Token must be exactly 6 digits'
    });
    if (tokenError) {
      return new Response(
        JSON.stringify({ error: tokenError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MFA Verify] User ${user.email} verifying 2FA`);

    // Get user's TOTP secret (encrypted)
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_secret')
      .eq('id', user.id)
      .single();

    if (!profile?.totp_secret) {
      throw new Error('TOTP secret not found. Please enroll first.');
    }

    // Decrypt the secret before verification
    const { data: decryptedSecret, error: decryptError } = await supabaseAdmin
      .rpc('decrypt_totp_secret', { encrypted_secret: profile.totp_secret });

    if (decryptError || !decryptedSecret) {
      console.error('[MFA Verify] Decryption error:', decryptError);
      throw new Error('Failed to decrypt TOTP secret');
    }

    console.log(`[MFA Verify] Secret decrypted successfully`);

    // Verify the TOTP code using decrypted secret
    const isValid = await verifyTOTP(decryptedSecret, code);
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

    console.log(`[MFA Verify] Code verified for ${user.email}`);

    // Generate recovery codes
    const recoveryCodes = generateBackupCodes(10);
    const hashedCodes = await Promise.all(recoveryCodes.map(c => hashCode(c.replace(/-/g, ''))));

    // Enable 2FA and store recovery codes using RPC to bypass cache
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
