import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateString, sanitizeErrorMessage } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tenant from header
    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'X-Tenant header required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check permissions
    const { data: membership } = await supabase
      .from('memberships')
      .select(`
        role_id,
        roles!inner (
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roleName = (membership.roles as any)?.name;
    const allowedRoles = ['owner', 'developer', 'merchant_admin'];
    
    if (!allowedRoles.includes(roleName)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MFA Step-up check
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    const mfaCheck = await requireStepUp({
      supabase,
      userId: user.id,
      tenantId,
      action: 'api-keys',
      userRole: roleName,
      isSuperAdmin: profile?.is_super_admin || false,
    });

    if (!mfaCheck.ok) {
      return createMfaError(mfaCheck.code!, mfaCheck.message!);
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 20 API key revocations per hour per user
    const rateLimitResult = checkRateLimit(user.id, 20, 3600000);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many API key revocation requests. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { api_key_id } = await req.json();

    // Input validation
    const apiKeyIdError = validateString('api_key_id', api_key_id, { required: true, maxLength: 255 });
    if (apiKeyIdError) {
      return new Response(
        JSON.stringify({ error: apiKeyIdError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Revoking API key:', api_key_id);

    // Revoke the API key
    const { data: revokedKey, error: revokeError } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', api_key_id)
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .select('id, name, prefix')
      .single();

    if (revokeError || !revokedKey) {
      console.error('Error revoking API key:', revokeError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to revoke API key', 
          details: revokeError?.message || 'Key not found or already revoked'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to audit_logs
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'api_key.revoked',
      target: `api_key:${revokedKey.id}`,
      before: {
        api_key_id: revokedKey.id,
        name: revokedKey.name,
        prefix: revokedKey.prefix
      }
    });

    console.log('API key revoked successfully:', revokedKey.id);

    return new Response(
      JSON.stringify({
        success: true,
        revoked_key: {
          id: revokedKey.id,
          name: revokedKey.name,
          prefix: revokedKey.prefix
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorMessage(error as Error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
