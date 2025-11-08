import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireStepUp, createMfaError } from '../_shared/mfa-guards.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

interface DecisionRequest {
  approvalId: string;
  decision: 'approve' | 'reject';
  comment?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing X-Tenant header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is owner/admin
    const { data: membership } = await supabase
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userRole = (membership.roles as any)?.name;
    if (!['owner', 'admin'].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: 'Only owners and admins can approve requests' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MFA Step-up required for approvals
    const mfaCheck = await requireStepUp({
      supabase: supabase as any,
      userId: user.id,
      tenantId,
      action: 'approvals',
      userRole
    });

    if (!mfaCheck.ok) {
      return createMfaError(mfaCheck.code!, mfaCheck.message!);
    }

    const body: DecisionRequest = await req.json();
    const { approvalId, decision, comment } = body;

    if (!approvalId || !decision || !['approve', 'reject'].includes(decision)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get approval details
    const { data: approval, error: approvalError } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .single();

    if (approvalError || !approval) {
      return new Response(
        JSON.stringify({ error: 'Approval not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (approval.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Approval already ${approval.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Can't approve own request
    if (approval.requested_by === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot approve your own request' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update approval status
    const { error: updateError } = await supabase
      .from('approvals')
      .update({
        status: decision === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: comment || null,
      })
      .eq('id', approvalId);

    if (updateError) throw updateError;

    // If approved, execute the original action
    if (decision === 'approve') {
      await executeApprovedAction(supabase, approval);
    }

    // Log the decision
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        actor_user_id: user.id,
        action: `approval.${decision}d`,
        target: `approval:${approvalId}`,
        before: { status: 'pending' },
        after: { status: decision, comment },
        ip: req.headers.get('x-forwarded-for') || null,
        user_agent: req.headers.get('user-agent') || null
      });

    console.log(`[Approval] ${decision} by ${user.id}: ${approvalId}`);

    return new Response(
      JSON.stringify({ success: true, decision }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Approval Decide] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process decision' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Execute the action that was approved
 */
async function executeApprovedAction(supabase: any, approval: any) {
  try {
    console.log(`[Approval] Executing approved action: ${approval.action_type}`);
    
    // Log the execution
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: approval.tenant_id,
        actor_user_id: approval.requested_by,
        action: `${approval.action_type}.executed_via_approval`,
        target: `approval:${approval.id}`,
        before: approval.action_data,
        after: { executed: true }
      });

    // TODO: Implement actual action execution based on action_type
    // This would call the appropriate service functions
    
  } catch (error) {
    console.error('[Approval] Execution error:', error);
    // Log the failure but don't throw - approval was already marked as approved
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: approval.tenant_id,
        actor_user_id: approval.requested_by,
        action: `${approval.action_type}.execution_failed`,
        target: `approval:${approval.id}`,
        after: { error: (error as Error).message }
      });
  }
}
