import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { createSecureErrorResponse, validateLength, createFriendlyErrorResponse } from "../_shared/error-handling.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { 
  validateString,
  validateFields,
  ValidationException,
  sanitizeErrorMessage
} from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

// Generate a random API key with prefix
const generateApiKey = (): { prefix: string; secret: string; fullKey: string } => {
  const prefix = 'sk_live';
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return {
    prefix,
    secret,
    fullKey: `${prefix}_${secret}`
  };
};

// Hash the secret for storage
const hashSecret = async (secret: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Verify user has permission
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // SECURITY: Rate limiting (10 API keys per hour per user)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `api-keys-create:${user.id}:${clientIp}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 10, 3600000, 0);
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 10 API keys per hour.',
          remaining: rateLimit.remaining 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateLimit.remaining)
          } 
        }
      );
    }

    // Check if user has api_keys:manage permission
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
        JSON.stringify({ error: 'Insufficient permissions. Required: owner, developer, or merchant_admin' }),
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

    // Parse request body
    const { name, key_type = 'internal', rate_limit_tier = 'standard', scope, ip_allowlist, notes, allowed_operations } = await req.json();
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate key_type
    if (key_type !== 'internal' && key_type !== 'external') {
      return new Response(
        JSON.stringify({ error: 'key_type must be "internal" or "external"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate IP allowlist for external keys
    if (key_type === 'external' && (!ip_allowlist || ip_allowlist.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'External keys require at least one IP in allowlist' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate API key
    const { prefix, secret, fullKey } = generateApiKey();
    const hashedSecret = await hashSecret(secret);

    console.log('Creating API key:', { name, prefix, tenantId });

    // Store in database
    const { data: apiKey, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        prefix: fullKey,
        hashed_secret: hashedSecret,
        created_by: user.id,
        key_type,
        rate_limit_tier,
        scope: scope || { endpoints: ['*'] },
        ip_allowlist: ip_allowlist || [],
        allowed_operations: allowed_operations || ['read', 'write'],
        notes: notes || null,
        env: 'production',
        status: 'active',
        is_active: true
      })
      .select('id, name, prefix, created_at, key_type, rate_limit_tier')
      .single();

    if (insertError) {
      console.error('Error creating API key:', insertError);
      return createFriendlyErrorResponse(
        'Failed to create API key',
        'API_KEY_CREATE_ERROR',
        500,
        corsHeaders
      );
    }

    // Log to audit_logs
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'api_key.created',
      target: `api_key:${apiKey.id}`,
      after: {
        api_key_id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        key_type: apiKey.key_type
      }
    });

    console.log('API key created successfully:', apiKey.id);

    return new Response(
      JSON.stringify({
        success: true,
        api_key: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          created_at: apiKey.created_at,
          // Return full key only once
          secret: fullKey
        },
        warning: 'Save this API key now. You will not be able to see it again.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[INTERNAL] API keys creation error:', error);
    return createSecureErrorResponse(error, 'api-keys-create', corsHeaders);
  }
});
