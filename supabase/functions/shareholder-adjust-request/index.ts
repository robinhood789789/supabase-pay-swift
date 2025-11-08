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

    console.log(`[Adjust Request] User ${user.id} requesting commission adjustment`);

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

    const { tenant_id, requested_percent } = await req.json();

    if (!tenant_id || requested_percent === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing tenant_id or requested_percent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate requested_percent is within allowed range
    if (requested_percent < shareholder.adjust_min_percent || requested_percent > shareholder.adjust_max_percent) {
      return new Response(
        JSON.stringify({ 
          error: `Commission percent must be between ${shareholder.adjust_min_percent}% and ${shareholder.adjust_max_percent}%` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current commission rate
    const { data: client, error: clientError } = await supabase
      .from('shareholder_clients')
      .select('commission_rate')
      .eq('shareholder_id', shareholder.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check MFA step-up
    const mfaResult = await requireStepUp({
      supabase,
      userId: user.id,
      action: 'approvals',
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

    // If allow_self_adjust and within range, apply immediately
    if (shareholder.allow_self_adjust) {
      console.log(`[Adjust Request] Self-adjust allowed, applying immediately`);
      
      const { error: updateError } = await supabase
        .from('shareholder_clients')
        .update({ 
          commission_rate: requested_percent,
          updated_at: new Date().toISOString()
        })
        .eq('shareholder_id', shareholder.id)
        .eq('tenant_id', tenant_id);

      if (updateError) throw updateError;

      // Create audit log
      await supabase.from('audit_logs').insert({
        actor_user_id: user.id,
        action: 'shareholder_commission_adjusted',
        target: `shareholder:${shareholder.id}`,
        before: { commission_rate: client.commission_rate },
        after: { commission_rate: requested_percent },
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent')
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Commission rate updated immediately',
          new_rate: requested_percent
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create adjustment request for approval
    console.log(`[Adjust Request] Creating request for approval`);
    
    const { data: request, error: requestError } = await supabase
      .from('shareholder_adjust_requests')
      .insert({
        shareholder_id: shareholder.id,
        tenant_id: tenant_id,
        current_percent: client.commission_rate,
        requested_percent: requested_percent,
        requested_by: user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (requestError) throw requestError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: user.id,
      action: 'shareholder_commission_adjust_requested',
      target: `shareholder:${shareholder.id}`,
      before: { commission_rate: client.commission_rate },
      after: { requested_rate: requested_percent },
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Adjustment request created and pending approval',
        request_id: request.id
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Adjust Request] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
