import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { requireStepUp } from '../_shared/mfa-guards.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { ShareholderPayoutRequest } from '../_shared/types.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid authorization');
    }

    console.log(`[Payout Request] User ${user.id} requesting payout`);

    // Get shareholder ID
    const { data: shareholder, error: shareholderError } = await supabase
      .from('shareholders')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (shareholderError || !shareholder) {
      return new Response(
        JSON.stringify({ error: 'Shareholder not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, bank_name, bank_account_number, bank_account_name, notes } = await req.json();

    if (!amount || !bank_name || !bank_account_number || !bank_account_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount
    if (amount <= 0 || amount > shareholder.balance) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount or insufficient balance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check MFA step-up
    const mfaResult = await requireStepUp({
      supabase,
      userId: user.id,
      action: 'withdrawal_request',
      isSuperAdmin: false
    });

    if (!mfaResult.ok) {
      return new Response(
        JSON.stringify({ 
          error: mfaResult.message,
          code: mfaResult.code
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create payout request
    const { data: payout, error: payoutError } = await supabase
      .from('shareholder_withdrawals')
      .insert({
        shareholder_id: shareholder.id,
        amount: amount,
        bank_name: bank_name,
        bank_account_number: bank_account_number,
        bank_account_name: bank_account_name,
        notes: notes,
        status: 'pending',
        requested_by: user.id
      })
      .select()
      .single();

    if (payoutError) throw payoutError;

    // Deduct from balance (move to pending)
    const { error: updateBalanceError } = await supabase
      .from('shareholders')
      .update({ 
        balance: shareholder.balance - amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', shareholder.id);

    if (updateBalanceError) throw updateBalanceError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: user.id,
      action: 'shareholder_payout_requested',
      target: `shareholder:${shareholder.id}`,
      before: { balance: shareholder.balance },
      after: { balance: shareholder.balance - amount, payout_id: payout.id },
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')
    });

    console.log(`[Payout Request] Created payout request ${payout.id} for ${amount} THB`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Payout request created successfully',
        payout_id: payout.id,
        new_balance: shareholder.balance - amount
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Payout Request] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
