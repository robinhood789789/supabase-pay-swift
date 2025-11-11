import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { requireStepUp } from '../_shared/mfa-guards.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant, x-csrf-token, cookie',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    console.log(`[Adjust Approve] User ${user.id} processing adjustment approval`);

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

    const { request_id, status, reason } = await req.json();

    if (!request_id || !status || !['approved', 'rejected'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid request_id or status' }),
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

    // Get the request
    const { data: request, error: requestError } = await supabase
      .from('shareholder_adjust_requests')
      .select('*')
      .eq('id', request_id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      return new Response(
        JSON.stringify({ error: 'Request not found or already processed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update request status
    const { error: updateRequestError } = await supabase
      .from('shareholder_adjust_requests')
      .update({
        status: status,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        reason: reason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', request_id);

    if (updateRequestError) throw updateRequestError;

    // If approved, update the commission rate
    if (status === 'approved') {
      const { error: updateClientError } = await supabase
        .from('shareholder_clients')
        .update({ 
          commission_rate: request.requested_percent,
          updated_at: new Date().toISOString()
        })
        .eq('shareholder_id', request.shareholder_id)
        .eq('tenant_id', request.tenant_id);

      if (updateClientError) throw updateClientError;

      console.log(`[Adjust Approve] Commission rate updated to ${request.requested_percent}%`);
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: user.id,
      action: status === 'approved' ? 'shareholder_commission_adjust_approved' : 'shareholder_commission_adjust_rejected',
      target: `shareholder:${request.shareholder_id}`,
      before: { status: 'pending', current_percent: request.current_percent },
      after: { status: status, new_percent: status === 'approved' ? request.requested_percent : request.current_percent },
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Request ${status} successfully`,
        new_rate: status === 'approved' ? request.requested_percent : request.current_percent
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Adjust Approve] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
