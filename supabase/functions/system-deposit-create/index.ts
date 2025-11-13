import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateAmount, validateString } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { DepositRequest, TransactionRequest } from '../_shared/types.ts';
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { 
  handleEnhancedError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  RateLimitError 
} from '../_shared/enhanced-errors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger('system-deposit-create');
  const requestContext = extractRequestContext(req);
  logger.setContext(requestContext);

  try {
    logger.logRequest(req);

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
      logger.warn('Authentication failed', { error: userError?.message });
      throw new AuthenticationError('Invalid or expired token');
    }
    
    logger.setContext({ userId: user.id });

    // Get tenant ID from header
    const tenantId = req.headers.get("x-tenant");
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }
    
    logger.setContext({ tenantId });
    logger.info('User authenticated successfully');

    // Verify user has owner or admin role in this tenant
    const { data: membership, error: membershipError } = await supabaseClient
      .from("memberships")
      .select("role_id, roles(name)")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (membershipError || !membership) {
      throw new AuthorizationError('User is not a member of this tenant');
    }

    const roleName = (membership.roles as any)?.name;
    if (roleName !== "owner") {
      logger.warn('Insufficient role', { userRole: roleName, requiredRole: 'owner' });
      throw new AuthorizationError('Only owners can create system deposits');
    }
    
    logger.info('Permission check passed', { userRole: roleName });

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
      logger.warn('Rate limit exceeded', { userId: user.id, resetAt: rateLimitResult.resetAt });
      throw new RateLimitError('Too many system deposit requests. Please try again later.', {
        resetAt: new Date(rateLimitResult.resetAt).toISOString()
      });
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
      logger.warn('Validation failed', { errors: validationErrors });
      throw new ValidationError(validationErrors.map(e => e.message).join(', '));
    }
    
    logger.info('Input validation passed', { amount, currency, method });

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
      logger.error('Failed to create payment', paymentError);
      throw new Error('Failed to create deposit: ' + paymentError.message);
    }
    
    logger.info('System deposit payment created', { paymentId: payment.id, amount, currency });

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

    logger.info('System deposit completed successfully');

    const response = {
      success: true,
      payment: payment,
      message: "System deposit created successfully",
    };

    logger.logResponse(200, response);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
