import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPaymentProvider } from "../_shared/providerFactory.ts";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { evaluateGuardrails, createApprovalRequest } from "../_shared/guardrails.ts";
import { checkRefundConcurrency } from "../_shared/concurrency.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateAmount, validateString } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { RefundRequest } from '../_shared/types.ts';
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { 
  handleEnhancedError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError 
} from '../_shared/enhanced-errors.ts';

// Rate limiting: Critical endpoint - strict rate limits enforced
// 20 requests per hour per user

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger('refunds-create');
  const requestContext = extractRequestContext(req);
  logger.setContext(requestContext);

  try {
    logger.logRequest(req);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get tenant ID from header
    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      throw new ValidationError('Missing X-Tenant header');
    }
    
    logger.setContext({ tenantId });

    // Authenticate request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AuthenticationError('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message });
      throw new AuthenticationError('Invalid or expired token');
    }
    
    logger.setContext({ userId: user.id });
    logger.info('User authenticated successfully');

    // Check refunds:create permission
    const { data: membership } = await supabase
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      throw new AuthorizationError('Not a member of this tenant');
    }

    const userRole = (membership.roles as any)?.name;

    const { data: permissions } = await supabase
      .from('role_permissions')
      .select('permissions(name)')
      .eq('role_id', membership.role_id);

    const hasPermission = permissions?.some(
      (rp: any) => rp.permissions?.name === 'refunds:create'
    );

    if (!hasPermission) {
      logger.warn('Permission denied', { userRole, requiredPermission: 'refunds:create' });
      throw new AuthorizationError('Missing refunds:create permission');
    }
    
    logger.info('Permission check passed', { userRole });

    // MFA Step-up check for refunds
    const mfaCheck = await requireStepUp({
      supabase: supabase as any,
      userId: user.id,
      tenantId,
      action: 'refund',
      userRole
    });

    if (!mfaCheck.ok) {
      return createMfaError(mfaCheck.code!, mfaCheck.message!);
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 20 refund requests per hour per user
    const rateLimitResult = checkRateLimit(user.id, 20, 3600000);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id, resetAt: rateLimitResult.resetAt });
      throw new RateLimitError('Too many refund requests. Please try again later.', {
        resetAt: new Date(rateLimitResult.resetAt).toISOString()
      });
    }

    // Parse request body
    const body: RefundRequest = await req.json();
    const { paymentId, amount, reason } = body;

    // Input validation
    const validationErrors = [];
    
    const paymentIdError = validateString('paymentId', paymentId, { required: true, maxLength: 255 });
    if (paymentIdError) validationErrors.push(paymentIdError);
    
    if (amount !== undefined) {
      const amountError = validateAmount(amount);
      if (amountError) validationErrors.push(amountError);
    }
    
    if (reason) {
      const reasonError = validateString('reason', reason, { maxLength: 1000 });
      if (reasonError) validationErrors.push(reasonError);
    }

    if (validationErrors.length > 0) {
      logger.warn('Validation failed', { errors: validationErrors });
      throw new ValidationError(validationErrors.map(e => e.message).join(', '));
    }
    
    logger.info('Input validation passed', { paymentId, amount });

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('tenant_id', tenantId)
      .single();

    if (paymentError || !payment) {
      logger.warn('Payment not found', { paymentId, error: paymentError?.message });
      throw new NotFoundError('Payment');
    }

    if (payment.status !== 'succeeded') {
      logger.warn('Invalid payment status for refund', { paymentId, status: payment.status });
      throw new ValidationError('Can only refund succeeded payments');
    }
    
    logger.info('Payment found and validated', { 
      paymentId, 
      amount: payment.amount, 
      status: payment.status 
    });

    // Calculate refund amount (default to full refund)
    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      logger.warn('Refund amount exceeds payment amount', { 
        refundAmount, 
        paymentAmount: payment.amount 
      });
      throw new ValidationError('Refund amount exceeds payment amount');
    }

    // Concurrency check - prevent double refunds
    const concurrencyCheck = await checkRefundConcurrency(supabase, paymentId, refundAmount);
    if (!concurrencyCheck.allowed) {
      logger.warn('Concurrency check failed', { error: concurrencyCheck.error });
      throw new ConflictError(concurrencyCheck.error || 'Refund already in progress');
    }

    // Check guardrails
    const guardrailCheck = await evaluateGuardrails(supabase, {
      action: 'refund',
      amount: refundAmount,
      currency: payment.currency,
      userId: user.id,
      tenantId,
      metadata: { payment_created_at: payment.created_at }
    });

    if (guardrailCheck.blocked) {
      logger.warn('Guardrail blocked refund', { reason: guardrailCheck.reason });
      throw new AuthorizationError('Action blocked by guardrail: ' + guardrailCheck.reason);
    }

    if (guardrailCheck.requiresApproval) {
      logger.info('Refund requires approval', { reason: guardrailCheck.reason });
      const approvalResult = await createApprovalRequest(supabase, {
        tenantId,
        requestedBy: user.id,
        actionType: 'refund',
        actionData: { paymentId, amount: refundAmount, reason },
        amount: refundAmount,
        reason: guardrailCheck.reason || 'Refund requires approval'
      });

      if ('error' in approvalResult) {
        return new Response(
          JSON.stringify({ error: approvalResult.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          requiresApproval: true, 
          approvalId: approvalResult.approvalId,
          message: 'Refund requires approval. An owner or admin must approve this request.'
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get payment provider
    const provider = await getPaymentProvider(supabase, tenantId);
    logger.info('Payment provider initialized', { provider: provider.constructor.name });

    logger.info('Processing refund', { 
      paymentId: paymentId.substring(0, 8) + '...', 
      amount: refundAmount, 
      currency: payment.currency 
    });

    // Create refund record with processing status (prevents concurrent refunds)
    const { data: refund, error: refundInsertError } = await supabase
      .from('refunds')
      .insert({
        payment_id: paymentId,
        tenant_id: tenantId,
        amount: refundAmount,
        reason: reason || null,
        status: 'processing'
      })
      .select()
      .single();

    if (refundInsertError) {
      logger.error('Failed to create refund record', refundInsertError);
      throw new Error('Failed to create refund record');
    }
    
    logger.info('Refund record created', { refundId: refund.id });

    // Call provider refund API
    try {
      const refundResponse = await provider.refund(
        payment.provider_payment_id,
        refundAmount,
        reason
      );

      logger.info('Provider refund successful', { 
        refundId: refund.id,
        providerRefundId: refundResponse.refundId,
        status: refundResponse.status 
      });

      // Update refund record with provider response
      await supabase
        .from('refunds')
        .update({
          provider_refund_id: refundResponse.refundId,
          status: refundResponse.status
        })
        .eq('id', refund.id);

      // Create audit log with full metadata
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                       req.headers.get('cf-connecting-ip') || 
                       'unknown';
      const userAgent = req.headers.get('user-agent')?.substring(0, 255) || null;

      await supabase
        .from('audit_logs')
        .insert({
          tenant_id: tenantId,
          actor_user_id: user.id,
          action: 'refund.created',
          target: `payment:${paymentId}`,
          before: { 
            payment_status: payment.status,
            payment_amount: payment.amount 
          },
          after: { 
            refund_id: refund.id,
            refund_amount: refundAmount,
            refund_status: refundResponse.status,
            provider_refund_id: refundResponse.refundId,
            request_id: requestContext.requestId
          },
          ip: clientIp.substring(0, 45),
          user_agent: userAgent
        });

      logger.info('Refund completed successfully', { refundId: refund.id });

      const response = {
        refundId: refund.id,
        status: refundResponse.status,
        amount: refundAmount,
        providerRefundId: refundResponse.refundId
      };

      logger.logResponse(200, response);

      return new Response(
        JSON.stringify({
          refundId: refund.id,
          status: refundResponse.status,
          amount: refundAmount,
          providerRefundId: refundResponse.refundId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      logger.error('Provider refund failed', error);
      
      // Update refund status to failed
      await supabase
        .from('refunds')
        .update({ status: 'failed' })
        .eq('id', refund.id);

      // Still create audit log for failed attempt
      await supabase
        .from('audit_logs')
        .insert({
          tenant_id: tenantId,
          actor_user_id: user.id,
          action: 'refund.failed',
          target: `payment:${paymentId}`,
          before: { payment_status: payment.status },
          after: { 
            refund_id: refund.id,
            refund_amount: refundAmount,
            error: (error as Error).message
          },
          ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
          user_agent: req.headers.get('user-agent') || null
        });

      return handleEnhancedError(error, logger);
    }

  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
