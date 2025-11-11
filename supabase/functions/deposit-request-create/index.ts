import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { createSecureErrorResponse } from "../_shared/error-handling.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateAmount, validateString } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Missing X-Tenant header' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has deposit.create permission (Admin, Manager)
    const { data: membership } = await supabaseClient
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userRole = (membership as any).roles.name;
    if (!['admin', 'manager'].includes(userRole)) {
      return new Response(JSON.stringify({ error: 'Only admin or manager can create deposit requests' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MFA Step-up check
    const mfaCheck = await requireStepUp({
      supabase: supabaseClient as any,
      userId: user.id,
      tenantId,
      action: 'deposit_request',
      userRole
    });

    if (!mfaCheck.ok) {
      return createMfaError(mfaCheck.code!, mfaCheck.message!);
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 10 deposit requests per hour per user
    const rateLimitResult = checkRateLimit(user.id, 10, 3600000);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many deposit requests. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, currency, method, reference, notes, reason } = await req.json();

    // Input validation
    const validationErrors = [];
    
    const amountError = validateAmount(amount);
    if (amountError) validationErrors.push(amountError);
    
    if (currency) {
      const currencyError = validateString('currency', currency, { maxLength: 3, pattern: /^[A-Z]{3}$/, patternMessage: 'Currency must be 3 uppercase letters' });
      if (currencyError) validationErrors.push(currencyError);
    }
    
    if (method) {
      const methodError = validateString('method', method, { maxLength: 50 });
      if (methodError) validationErrors.push(methodError);
    }
    
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create approval request for deposit
    const { data: approval, error: approvalError } = await supabaseClient
      .from('approvals')
      .insert({
        tenant_id: tenantId,
        requested_by: user.id,
        action_type: 'deposit_request',
        action_data: {
          amount,
          currency: currency || 'THB',
          method: method || 'bank_transfer',
          reference,
          notes,
          reason,
        },
        status: 'pending',
      })
      .select()
      .single();

    if (approvalError) throw approvalError;

    // Audit log
    await supabaseClient.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'deposit_request_created',
      target: 'approval',
      after: approval,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      approvalId: approval.id,
      message: 'Deposit request created and pending owner/manager approval'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createSecureErrorResponse(error, 'deposit-request-create', corsHeaders);
  }
});
