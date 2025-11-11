import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { generateTOTPSecret, getTOTPQRCodeUrl } from "../_shared/totp.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { MfaEnrollRequest } from '../_shared/types.ts';

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

    // Rate limiting: 10 enrollments per hour per user
    const rateLimitResult = checkRateLimit(user.id, 10, 3600000); // 10 attempts, 1 hour window
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many MFA enrollment attempts. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    console.log(`[MFA Enroll] User ${user.email} enrolling in 2FA`);

    // Generate TOTP secret
    const secret = generateTOTPSecret();
    const otpauthUrl = getTOTPQRCodeUrl(secret, user.email!, 'Payment Platform');

    // Store temporary secret (not yet verified) using RPC to bypass cache issues
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabaseAdmin.rpc('update_totp_secret', {
      user_id: user.id,
      new_secret: secret
    });

    if (updateError) {
      console.error('[MFA Enroll] Error storing secret:', updateError);
      throw updateError;
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        action: 'mfa.enroll.initiated',
        target: `user:${user.id}`,
        tenant_id: null,
        ip: clientIp,
        user_agent: req.headers.get('user-agent')?.substring(0, 255) || null,
      });

    return new Response(
      JSON.stringify({ 
        secret,
        otpauthUrl,
        message: 'Scan the QR code with your authenticator app'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[MFA Enroll] Error:', error);
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
