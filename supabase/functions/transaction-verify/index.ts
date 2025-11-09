import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transactionId, note } = await req.json();

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying transaction ${transactionId} by user ${user.id}`);

    // Update transaction with verification info
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        verified_by: user.id,
        verification_note: note || null,
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error verifying transaction:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify transaction', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the verification action
    const tenantId = req.headers.get('x-tenant');
    if (tenantId) {
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        actor_user_id: user.id,
        action: 'TRANSACTION_VERIFIED',
        target: `transactions:${transactionId}`,
        after: {
          transaction_id: transactionId,
          verified_by: user.id,
          note: note || null,
        },
      });
    }

    console.log(`Transaction ${transactionId} verified successfully`);

    return new Response(
      JSON.stringify({ success: true, transaction }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in transaction-verify function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});