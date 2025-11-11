import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateAmount, validateString, sanitizeErrorMessage } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { DepositRequest, TransactionRequest } from '../_shared/types.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant ID from header
    const tenantId = req.headers.get("x-tenant");
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has owner or admin role in this tenant
    const { data: membership, error: membershipError } = await supabaseClient
      .from("memberships")
      .select("role_id, roles(name)")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: "User is not a member of this tenant" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const roleName = (membership.roles as any)?.name;
    if (roleName !== "owner") {
      return new Response(
        JSON.stringify({ error: "Only owners can create system deposits" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // MFA Step-up check
    const mfaCheck = await requireStepUp({
      supabase: supabaseClient as any,
      userId: user.id,
      tenantId,
      action: 'system_deposit',
      userRole: roleName
    });

    if (!mfaCheck.ok) {
      return createMfaError(mfaCheck.code!, mfaCheck.message!);
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 20 system deposits per hour per user
    const rateLimitResult = checkRateLimit(user.id, 20, 3600000);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many system deposit requests. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { amount, currency, method, reference, notes } = await req.json();

    // Input validation
    const validationErrors = [];
    
    const amountError = validateAmount(amount);
    if (amountError) validationErrors.push(amountError);
    
    const currencyError = validateString('currency', currency, { required: true, maxLength: 3, pattern: /^[A-Z]{3}$/, patternMessage: 'Currency must be 3 uppercase letters' });
    if (currencyError) validationErrors.push(currencyError);
    
    const methodError = validateString('method', method, { required: true, maxLength: 50 });
    if (methodError) validationErrors.push(methodError);
    
    if (reference) {
      const referenceError = validateString('reference', reference, { maxLength: 100 });
      if (referenceError) validationErrors.push(referenceError);
    }
    
    if (notes) {
      const notesError = validateString('notes', notes, { maxLength: 500 });
      if (notesError) validationErrors.push(notesError);
    }

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: validationErrors.map(e => e.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payment record with type = 'deposit' and status = 'succeeded'
    const { data: payment, error: paymentError } = await supabaseClient
      .from("payments")
      .insert({
        tenant_id: tenantId,
        type: "deposit",
        status: "succeeded",
        amount: amount,
        currency: currency,
        method: method,
        provider: "system",
        paid_at: new Date().toISOString(),
        metadata: {
          reference: reference || null,
          notes: notes || null,
          created_by: user.id,
          created_by_email: user.email,
        },
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      return new Response(
        JSON.stringify({ error: "Failed to create deposit", details: paymentError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log audit activity
    await supabaseClient.from("audit_logs").insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: "system_deposit_created",
      target: `payment:${payment.id}`,
      after: {
        payment_id: payment.id,
        amount: amount,
        currency: currency,
        method: method,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment: payment,
        message: "System deposit created successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in system-deposit-create:", error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorMessage(error as Error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
