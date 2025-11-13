import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getPaymentProvider } from "../_shared/providerFactory.ts";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateAmount, validateString, validateEmail, sanitizeErrorMessage } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { CheckoutSessionRequest } from '../_shared/types.ts';

function validateRequest(body: any): CheckoutSessionRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const { amount, currency, reference, successUrl, cancelUrl, methodTypes } = body;

  if (typeof amount !== "number" || amount <= 0) {
    throw new Error("amount must be a positive number");
  }

  if (typeof currency !== "string" || !currency.trim()) {
    throw new Error("currency is required");
  }

  if (reference !== undefined && typeof reference !== "string") {
    throw new Error("reference must be a string");
  }

  if (successUrl !== undefined && typeof successUrl !== "string") {
    throw new Error("successUrl must be a string");
  }

  if (cancelUrl !== undefined && typeof cancelUrl !== "string") {
    throw new Error("cancelUrl must be a string");
  }

  if (!Array.isArray(methodTypes) || methodTypes.length === 0) {
    throw new Error("methodTypes must be a non-empty array");
  }

  return { amount, currency, reference, successUrl, cancelUrl, methodTypes, tenantId: '' };
}

async function authenticateRequest(
  req: Request,
  supabase: any,
  tenantId: string
): Promise<{ authenticated: boolean; userId?: string }> {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader) {
    return { authenticated: false };
  }

  // Check if it's a Bearer token (user auth)
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    
    // Verify JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { authenticated: false };
    }

    // Check if user has payments:create permission
    const { data: membership } = await supabase
      .from("memberships")
      .select("role_id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!membership) {
      return { authenticated: false };
    }

    const { data: permissions } = await supabase
      .from("role_permissions")
      .select("permissions(name)")
      .eq("role_id", membership.role_id);

    const hasPermission = permissions?.some(
      (rp: any) => rp.permissions.name === "payments:create"
    );

    if (!hasPermission) {
      return { authenticated: false };
    }

    return { authenticated: true, userId: user.id };
  }

  // Check if it's an API key
  if (authHeader.startsWith("sk_")) {
    const [prefix, ...secretParts] = authHeader.split("_");
    const fullPrefix = `${prefix}_${secretParts[0]}`;
    
    // Hash the secret for comparison
    const encoder = new TextEncoder();
    const data = encoder.encode(authHeader);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedSecret = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const { data: apiKey } = await supabase
      .from("api_keys")
      .select("id, tenant_id, revoked_at")
      .eq("prefix", fullPrefix)
      .eq("hashed_secret", hashedSecret)
      .eq("tenant_id", tenantId)
      .single();

    if (!apiKey || apiKey.revoked_at) {
      return { authenticated: false };
    }

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKey.id);

    return { authenticated: true };
  }

  return { authenticated: false };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant ID from header
    const tenantId = req.headers.get("x-tenant");
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "X-Tenant header is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate
    const auth = await authenticateRequest(req, supabase, tenantId);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MFA Step-up check for user-initiated payment creation
    if (auth.userId) {
      // CSRF validation for user sessions
      const csrfError = await requireCSRF(req, auth.userId);
      if (csrfError) return csrfError;

      // Rate limiting: 100 checkout sessions per hour per user
      const rateLimitResult = checkRateLimit(auth.userId, 100, 3600000);
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({ 
            error: 'Too many checkout session requests. Please try again later.',
            resetAt: new Date(rateLimitResult.resetAt).toISOString()
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user role and check if super admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', auth.userId)
        .single();

      const { data: membership } = await supabase
        .from('memberships')
        .select(`
          role_id,
          roles!inner (
            name
          )
        `)
        .eq('user_id', auth.userId)
        .eq('tenant_id', tenantId)
        .single();

      const userRole = (membership?.roles as any)?.name;

      const mfaCheck = await requireStepUp({
        supabase,
        userId: auth.userId,
        tenantId,
        action: 'create-payment',
        userRole,
        isSuperAdmin: profile?.is_super_admin || false,
      });

      if (!mfaCheck.ok) {
        return createMfaError(mfaCheck.code!, mfaCheck.message!);
      }
    }

    // Check for idempotency key
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from("idempotency_keys")
        .select("response")
        .eq("tenant_id", tenantId)
        .eq("key", idempotencyKey)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (existing) {
        console.log("Returning cached response for idempotency key:", idempotencyKey);
        return new Response(
          JSON.stringify(existing.response),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse and validate request
    const body = await req.json();
    
    // Additional input validation
    const validationErrors = [];
    
    if (body.amount) {
      const amountError = validateAmount(body.amount);
      if (amountError) validationErrors.push(amountError);
    }
    
    if (body.currency) {
      const currencyError = validateString('currency', body.currency, { 
        maxLength: 3, 
        pattern: /^[A-Z]{3}$/,
        patternMessage: 'Currency must be 3 uppercase letters'
      });
      if (currencyError) validationErrors.push(currencyError);
    }
    
    if (body.reference) {
      const refError = validateString('reference', body.reference, { maxLength: 200 });
      if (refError) validationErrors.push(refError);
    }
    
    if (body.successUrl) {
      try {
        new URL(body.successUrl);
      } catch {
        validationErrors.push({ field: 'successUrl', message: 'Success URL must be a valid URL' });
      }
    }
    
    if (body.cancelUrl) {
      try {
        new URL(body.cancelUrl);
      } catch {
        validationErrors.push({ field: 'cancelUrl', message: 'Cancel URL must be a valid URL' });
      }
    }

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: validationErrors.map(e => e.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const params = validateRequest(body);

    // Override tenantId with actual value
    params.tenantId = tenantId;

    // Get payment provider
    const provider = await getPaymentProvider(supabase, tenantId);

    // Secure logging - no PII
    console.log(`[Checkout] Creating session for tenant ${tenantId}, amount: ${params.amount} ${params.currency}`);

    // Create session with provider
    const providerSession = await provider.createCheckoutSession(params);

    // Store in database
    const { data: session, error: dbError } = await supabase
      .from("checkout_sessions")
      .insert({
        tenant_id: tenantId,
        amount: params.amount,
        currency: params.currency,
        reference: params.reference,
        method_types: params.methodTypes,
        provider: provider.name,
        provider_session_id: providerSession.providerSessionId,
        redirect_url: providerSession.redirectUrl,
        qr_image_url: providerSession.qrImageUrl,
        expires_at: providerSession.expiresAt,
        status: providerSession.status || "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to create checkout session");
    }

    const response = {
      id: session.id,
      redirect_url: session.redirect_url,
      qr_image_url: session.qr_image_url,
      status: session.status,
      expires_at: session.expires_at,
    };

    // Store idempotency key if provided
    if (idempotencyKey) {
      await supabase
        .from("idempotency_keys")
        .insert({
          tenant_id: tenantId,
          key: idempotencyKey,
          response,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        });
    }

    // Create audit log if user-initiated
    if (auth.userId) {
      await supabase
        .from('audit_logs')
        .insert({
          tenant_id: tenantId,
          actor_user_id: auth.userId,
          action: 'checkout.session.created',
          target: `session:${session.id}`,
          after: {
            session_id: session.id,
            amount: params.amount,
            currency: params.currency,
            provider: provider.name,
          },
          // Redact full IP for privacy
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.substring(0, 15) || null,
          user_agent: req.headers.get('user-agent')?.substring(0, 255) || null
        });
    }

    console.log(`[Checkout] Session created: ${session.id}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Secure error logging - no sensitive data
    console.error('[Checkout] Error:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: sanitizeErrorMessage(error as Error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
