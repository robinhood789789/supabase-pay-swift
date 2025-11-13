import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateAmount, validateString } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { WithdrawalRequest } from '../_shared/types.ts';
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

  const logger = createLogger('withdrawal-request-create');
  const requestContext = extractRequestContext(req);
  logger.setContext(requestContext);

  try {
    logger.logRequest(req);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      throw new ValidationError('Missing X-Tenant header');
    }
    
    logger.setContext({ tenantId });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message });
      throw new AuthenticationError('Invalid or expired token');
    }
    
    logger.setContext({ userId: user.id });
    logger.info('User authenticated successfully');

    // Check if user has withdrawal.create permission (Admin, Manager)
    const { data: membership } = await supabaseClient
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      throw new AuthorizationError('Not a member of this tenant');
    }

    const userRole = (membership as any).roles.name;
    if (!['admin', 'manager'].includes(userRole)) {
      logger.warn('Insufficient role', { userRole, requiredRoles: ['admin', 'manager'] });
      throw new AuthorizationError('Only admin or manager can create withdrawal requests');
    }
    
    logger.info('Permission check passed', { userRole });

    // MFA Step-up check
    const mfaCheck = await requireStepUp({
      supabase: supabaseClient as any,
      userId: user.id,
      tenantId,
      action: 'withdrawal_request',
      userRole
    });

    if (!mfaCheck.ok) {
      return createMfaError(mfaCheck.code!, mfaCheck.message!);
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 10 withdrawal requests per hour per user
    const rateLimitResult = checkRateLimit(user.id, 10, 3600000);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id, resetAt: rateLimitResult.resetAt });
      throw new RateLimitError('Too many withdrawal requests. Please try again later.', {
        resetAt: new Date(rateLimitResult.resetAt).toISOString()
      });
    }

    const { amount, currency, method, bank_name, bank_account_number, bank_account_name, notes, reason } = await req.json();

    // Input validation
    const validationErrors = [];
    
    const amountError = validateAmount(amount);
    if (amountError) validationErrors.push(amountError);
    
    if (currency) {
      const currencyError = validateString('currency', currency, { maxLength: 3, pattern: /^[A-Z]{3}$/, patternMessage: 'Currency must be 3 uppercase letters' });
      if (currencyError) validationErrors.push(currencyError);
    }
    
    if (bank_name) {
      const bankNameError = validateString('bank_name', bank_name, { maxLength: 100 });
      if (bankNameError) validationErrors.push(bankNameError);
    }
    
    if (bank_account_number) {
      const accountError = validateString('bank_account_number', bank_account_number, { maxLength: 50 });
      if (accountError) validationErrors.push(accountError);
    }
    
    if (bank_account_name) {
      const accountNameError = validateString('bank_account_name', bank_account_name, { maxLength: 200 });
      if (accountNameError) validationErrors.push(accountNameError);
    }

    if (validationErrors.length > 0) {
      logger.warn('Validation failed', { errors: validationErrors });
      throw new ValidationError(validationErrors.map(e => e.message).join(', '));
    }
    
    logger.info('Input validation passed', { amount, currency, method });

    // Check balance
    const { data: wallet } = await supabaseClient
      .from('tenant_wallets')
      .select('balance')
      .eq('tenant_id', tenantId)
      .single();

    if (!wallet || wallet.balance < amount) {
      logger.warn('Insufficient balance', { balance: wallet?.balance, requested: amount });
      throw new ValidationError('Insufficient balance');
    }
    
    logger.info('Balance check passed', { balance: wallet.balance, requested: amount });

    // Create approval request for withdrawal
    const { data: approval, error: approvalError } = await supabaseClient
      .from('approvals')
      .insert({
        tenant_id: tenantId,
        requested_by: user.id,
        action_type: 'withdrawal_request',
        action_data: {
          amount,
          currency: currency || 'THB',
          method: method || 'bank_transfer',
          bank_name,
          bank_account_number,
          bank_account_name,
          notes,
          reason,
        },
        status: 'pending',
      })
      .select()
      .single();

    if (approvalError) {
      logger.error('Failed to create approval', approvalError);
      throw approvalError;
    }
    
    logger.info('Withdrawal request approval created', { approvalId: approval.id });

    // Audit log
    await supabaseClient.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'withdrawal_request_created',
      target: 'approval',
      after: approval,
    });

    logger.info('Withdrawal request completed successfully');

    const response = { 
      success: true, 
      approvalId: approval.id,
      message: 'Withdrawal request created and pending owner/manager approval'
    };

    logger.logResponse(200, response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
