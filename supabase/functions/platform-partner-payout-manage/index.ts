import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { requireStepUp } from '../_shared/mfa-guards.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log(`[Platform Payout Manage] User ${user.id} managing payout`);

    // Verify Super Admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Super Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { payout_id, action, reason, bank_reference } = await req.json();

    if (!payout_id || !action || !['approve', 'reject', 'mark_paid', 'mark_failed'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check MFA step-up
    const mfaResult = await requireStepUp({
      supabase,
      userId: user.id,
      action: 'approvals',
      isSuperAdmin: true
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

    // Get current payout
    const { data: payout, error: payoutError } = await supabase
      .from('shareholder_withdrawals')
      .select('*')
      .eq('id', payout_id)
      .single();

    if (payoutError || !payout) {
      return new Response(
        JSON.stringify({ error: 'Payout not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dual control: Prevent self-approval
    if (payout.requested_by === user.id && ['approve', 'mark_paid'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Dual control violation: Cannot approve your own request' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let newStatus = payout.status;
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    switch (action) {
      case 'approve':
        if (payout.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Payout is not in pending state' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        newStatus = 'approved';
        updateData.status = 'approved';
        updateData.approved_by = user.id;
        updateData.approved_at = new Date().toISOString();
        break;

      case 'reject':
        if (payout.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Payout is not in pending state' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        newStatus = 'rejected';
        updateData.status = 'rejected';
        updateData.approved_by = user.id;
        updateData.approved_at = new Date().toISOString();
        updateData.notes = reason || 'Rejected by admin';
        
        // Refund balance
        const { data: rejectBalance } = await supabase
          .from('shareholders')
          .select('balance')
          .eq('id', payout.shareholder_id)
          .single();
        
        if (rejectBalance) {
          await supabase
            .from('shareholders')
            .update({ 
              balance: Number(payout.amount) + Number(rejectBalance.balance)
            })
            .eq('id', payout.shareholder_id);
        }
        break;

      case 'mark_paid':
        if (!['pending', 'approved'].includes(payout.status)) {
          return new Response(
            JSON.stringify({ error: 'Payout cannot be marked as paid' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        newStatus = 'completed';
        updateData.status = 'completed';
        updateData.paid_at = new Date().toISOString();
        if (bank_reference) updateData.bank_reference = bank_reference;
        break;

      case 'mark_failed':
        newStatus = 'failed';
        updateData.status = 'failed';
        updateData.notes = reason || 'Failed';
        
        // Refund balance
        const { data: failedBalance } = await supabase
          .from('shareholders')
          .select('balance')
          .eq('id', payout.shareholder_id)
          .single();
        
        if (failedBalance) {
          await supabase
            .from('shareholders')
            .update({ 
              balance: Number(payout.amount) + Number(failedBalance.balance)
            })
            .eq('id', payout.shareholder_id);
        }
        break;
    }

    // Update payout
    const { error: updateError } = await supabase
      .from('shareholder_withdrawals')
      .update(updateData)
      .eq('id', payout_id);

    if (updateError) throw updateError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: user.id,
      action: `platform_partner_payout_${action}`,
      target: `payout:${payout_id}`,
      before: payout,
      after: { ...payout, ...updateData },
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')
    });

    console.log(`[Platform Payout Manage] ${action} payout ${payout_id}, new status: ${newStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Payout ${action} successful`,
        new_status: newStatus
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Platform Payout Manage] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
