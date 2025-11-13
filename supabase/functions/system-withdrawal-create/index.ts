import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { requireStepUp } from "../_shared/mfa-guards.ts";
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

  const logger = createLogger('system-withdrawal-create');
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

    // Check if user is owner
    const { data: membership } = await supabaseClient
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership || (membership as any).roles.name !== 'owner') {
      logger.warn('Insufficient role', { userRole: (membership as any)?.roles?.name, requiredRole: 'owner' });
      throw new AuthorizationError('Only owners can create system withdrawals');
    }
    
    logger.info('Permission check passed', { userRole: 'owner' });

    // MFA Step-up check
    const stepUpResult = await requireStepUp({
      supabase: supabaseClient,
      userId: user.id,
      tenantId,
      action: 'payout',
      userRole: 'owner',
      isSuperAdmin: false,
    });

    if (!stepUpResult.ok) {
      return new Response(JSON.stringify({ 
        error: stepUpResult.message || 'MFA verification required',
        requireMfa: true,
        code: stepUpResult.code
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 10 system withdrawals per hour per user
    const rateLimitResult = checkRateLimit(user.id, 10, 3600000);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id, resetAt: rateLimitResult.resetAt });
      throw new RateLimitError('Too many system withdrawal requests. Please try again later.', {
        resetAt: new Date(rateLimitResult.resetAt).toISOString()
      });
    }

    const { amount, currency, method, bank_name, bank_account_number, bank_account_name, notes } = await req.json();

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

    // Get tenant wallet balance
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

    // Get tenant settings for limits
    const { data: settings } = await supabaseClient
      .from('tenant_settings')
      .select('withdrawal_daily_limit, withdrawal_per_transaction_limit, withdrawal_approval_threshold')
      .eq('tenant_id', tenantId)
      .single();

    // Check per-transaction limit
    if (settings?.withdrawal_per_transaction_limit && amount > settings.withdrawal_per_transaction_limit) {
      logger.warn('Per-transaction limit exceeded', { 
        amount, 
        limit: settings.withdrawal_per_transaction_limit 
      });
      throw new ValidationError(`Amount exceeds per-transaction limit of ${settings.withdrawal_per_transaction_limit / 100}`);
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayWithdrawals } = await supabaseClient
      .from('payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('type', 'withdrawal')
      .eq('status', 'succeeded')
      .gte('created_at', today.toISOString());

    const todayTotal = (todayWithdrawals || []).reduce((sum, w) => sum + w.amount, 0);
    if (settings?.withdrawal_daily_limit && (todayTotal + amount) > settings.withdrawal_daily_limit) {
      logger.warn('Daily withdrawal limit exceeded', { 
        todayTotal, 
        requested: amount, 
        limit: settings.withdrawal_daily_limit 
      });
      throw new ValidationError(`Daily withdrawal limit exceeded. Today: ${todayTotal / 100}, Limit: ${settings.withdrawal_daily_limit / 100}`);
    }
    
    logger.info('Limits check passed', { todayTotal, amount });

    // Check if approval is required
    if (settings?.withdrawal_approval_threshold && amount >= settings.withdrawal_approval_threshold) {
      logger.info('Withdrawal requires approval', { 
        amount, 
        threshold: settings.withdrawal_approval_threshold 
      });

      // Create approval request
      const { data: approval, error: approvalError } = await supabaseClient
        .from('approvals')
        .insert({
          tenant_id: tenantId,
          requested_by: user.id,
          action_type: 'system_withdrawal',
          action_data: {
            amount,
            currency,
            method,
            bank_name,
            bank_account_number,
            bank_account_name,
            notes,
          },
          status: 'pending',
        })
        .select()
        .single();

      if (approvalError) {
        logger.error('Failed to create approval', approvalError);
        throw approvalError;
      }
      
      logger.info('Approval request created', { approvalId: approval.id });

      // Audit log
      await supabaseClient.from('audit_logs').insert({
        tenant_id: tenantId,
        actor_user_id: user.id,
        action: 'system_withdrawal_request_created',
        target: 'approval',
        after: approval,
      });

      const response = { 
        success: true, 
        requiresApproval: true,
        approvalId: approval.id,
        message: 'Withdrawal request created and pending approval'
      };

      logger.logResponse(200, response);

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create withdrawal directly
    const { data: withdrawal, error: withdrawalError } = await supabaseClient
      .from('payments')
      .insert({
        tenant_id: tenantId,
        type: 'withdrawal',
        amount,
        currency: currency || 'THB',
        status: 'succeeded',
        method: method || 'bank_transfer',
        bank_name,
        bank_account_number,
        bank_account_name,
        withdrawal_notes: notes,
      })
      .select()
      .single();

    if (withdrawalError) {
      logger.error('Failed to create withdrawal', withdrawalError);
      throw withdrawalError;
    }
    
    logger.info('System withdrawal created', { withdrawalId: withdrawal.id, amount });

    // Audit log
    await supabaseClient.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'system_withdrawal_created',
      target: 'payment',
      after: withdrawal,
    });

    logger.info('System withdrawal completed successfully');

    const response = { success: true, withdrawal };

    logger.logResponse(200, response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
