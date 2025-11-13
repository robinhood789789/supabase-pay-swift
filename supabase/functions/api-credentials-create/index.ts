import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { createSecureErrorResponse, createFriendlyErrorResponse } from "../_shared/error-handling.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Generate API Key (public identifier)
const generateApiKey = (): string => {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `sk_test_${key}`;
};

// Generate API Secret (private key)
const generateApiSecret = (): string => {
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  const secret = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `sec_test_${secret}`;
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

    // Verify user
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

    // SECURITY: Rate limiting (10 API credentials per hour per user)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `api-credentials-create:${user.id}:${clientIp}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 10, 3600000, 0);
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 10 API credentials per hour.',
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

    // Parse request body
    const { name, description, rate_limit_tier = 'standard', ip_allowlist, expires_in_days } = await req.json();
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate API Key and Secret
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();
    const hashedSecret = await hashSecret(apiSecret);

    // Calculate expiration
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expires_in_days);
      expiresAt = expiryDate.toISOString();
    }

    console.log('Creating API credentials:', { name, apiKey, tenantId });

    // Store in database
    const { data: credential, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        prefix: apiKey,  // Store API Key as prefix (public identifier)
        hashed_key: hashedSecret,  // Store hashed secret
        key_type: 'secret',  // Type for API Key + Secret pair
        rate_limit_tier,
        scope: { endpoints: ['*'] },
        ip_allowlist: ip_allowlist || [],
        allowed_operations: ['read', 'write'],
        status: 'active',
        is_active: true,
        expires_at: expiresAt
      })
      .select('id, name, prefix, created_at, rate_limit_tier, expires_at')
      .single();

    if (insertError) {
      console.error('Error creating API credentials:', insertError);
      return createFriendlyErrorResponse(
        'Failed to create API credentials',
        'API_CREDENTIAL_CREATE_ERROR',
        500,
        corsHeaders
      );
    }

    // Log to audit_logs
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'api_credentials.created',
      target: `api_credential:${credential.id}`,
      after: {
        credential_id: credential.id,
        name: credential.name,
        api_key: apiKey
      }
    });

    console.log('API credentials created successfully:', credential.id);

    return new Response(
      JSON.stringify({
        success: true,
        credentials: {
          id: credential.id,
          name: credential.name,
          api_key: apiKey,
          api_secret: apiSecret,
          created_at: credential.created_at,
          expires_at: credential.expires_at,
          rate_limit_tier: credential.rate_limit_tier
        },
        warning: 'Save these credentials now. The API Secret will not be shown again.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[INTERNAL] API credentials creation error:', error);
    return createSecureErrorResponse(error, 'api-credentials-create', corsHeaders);
  }
});
