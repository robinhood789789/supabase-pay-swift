import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { requireStepUp } from '../_shared/mfa-guards.ts';
import { corsHeaders, handleCorsPreflight, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

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

    console.log(`[Platform Commission Update] User ${user.id} updating commission`);

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

    const { partner_id, tenant_id, commission_rate, commission_type, bounty_amount, effective_from, effective_to } = await req.json();

    if (!partner_id || !tenant_id || commission_rate === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
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

    // Get current values for audit
    const { data: currentLink } = await supabase
      .from('shareholder_clients')
      .select('*')
      .eq('shareholder_id', partner_id)
      .eq('tenant_id', tenant_id)
      .single();

    // Update commission
    const updateData: any = {
      commission_rate: commission_rate,
      updated_at: new Date().toISOString()
    };

    if (commission_type) updateData.commission_type = commission_type;
    if (bounty_amount !== undefined) updateData.bounty_amount = bounty_amount;
    if (effective_from) updateData.effective_from = effective_from;
    if (effective_to !== undefined) updateData.effective_to = effective_to;

    const { error: updateError } = await supabase
      .from('shareholder_clients')
      .update(updateData)
      .eq('shareholder_id', partner_id)
      .eq('tenant_id', tenant_id);

    if (updateError) throw updateError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: user.id,
      action: 'platform_partner_commission_updated',
      target: `partner:${partner_id},tenant:${tenant_id}`,
      before: currentLink,
      after: updateData,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')
    });

    console.log(`[Platform Commission Update] Updated commission for partner ${partner_id}, tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Commission updated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Platform Commission Update] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
