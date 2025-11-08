import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStepUp } from "../_shared/mfa-guards.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Check if user is owner
    const { data: membership } = await supabaseClient
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership || (membership as any).roles.name !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owners can create system withdrawals' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const { amount, currency, method, bank_name, bank_account_number, bank_account_name, notes } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant wallet balance
    const { data: wallet } = await supabaseClient
      .from('tenant_wallets')
      .select('balance')
      .eq('tenant_id', tenantId)
      .single();

    if (!wallet || wallet.balance < amount) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant settings for limits
    const { data: settings } = await supabaseClient
      .from('tenant_settings')
      .select('withdrawal_daily_limit, withdrawal_per_transaction_limit, withdrawal_approval_threshold')
      .eq('tenant_id', tenantId)
      .single();

    // Check per-transaction limit
    if (settings?.withdrawal_per_transaction_limit && amount > settings.withdrawal_per_transaction_limit) {
      return new Response(JSON.stringify({ error: `Amount exceeds per-transaction limit of ${settings.withdrawal_per_transaction_limit / 100}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: `Daily withdrawal limit exceeded. Today: ${todayTotal / 100}, Limit: ${settings.withdrawal_daily_limit / 100}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if approval is required
    if (settings?.withdrawal_approval_threshold && amount >= settings.withdrawal_approval_threshold) {
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

      if (approvalError) throw approvalError;

      // Audit log
      await supabaseClient.from('audit_logs').insert({
        tenant_id: tenantId,
        actor_user_id: user.id,
        action: 'system_withdrawal_request_created',
        target: 'approval',
        after: approval,
      });

      return new Response(JSON.stringify({ 
        success: true, 
        requiresApproval: true,
        approvalId: approval.id,
        message: 'Withdrawal request created and pending approval'
      }), {
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

    if (withdrawalError) throw withdrawalError;

    // Audit log
    await supabaseClient.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'system_withdrawal_created',
      target: 'payment',
      after: withdrawal,
    });

    return new Response(JSON.stringify({ success: true, withdrawal }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in system-withdrawal-create:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
