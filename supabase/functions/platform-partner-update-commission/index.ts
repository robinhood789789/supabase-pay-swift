import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { requireStepUp } from '../_shared/mfa-guards.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

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

    console.log(`[Platform Partner Update Commission] User ${user.id} updating partner commission`);

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

    const { partnerId, default_commission_type, default_commission_value } = await req.json();

    if (!partnerId || default_commission_value === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: partnerId and default_commission_value' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate commission value
    if (default_commission_value < 0 || default_commission_value > 100) {
      return new Response(
        JSON.stringify({ error: 'Commission value must be between 0 and 100' }),
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
    const { data: currentPartner } = await supabase
      .from('shareholders')
      .select('*')
      .eq('id', partnerId)
      .single();

    if (!currentPartner) {
      return new Response(
        JSON.stringify({ error: 'Partner not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update partner commission settings
    const updateData: any = {
      default_commission_value: default_commission_value,
      updated_at: new Date().toISOString()
    };

    if (default_commission_type) {
      updateData.default_commission_type = default_commission_type;
    }

    const { error: updateError } = await supabase
      .from('shareholders')
      .update(updateData)
      .eq('id', partnerId);

    if (updateError) throw updateError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: user.id,
      action: 'platform_partner_commission_updated',
      target: `shareholder:${partnerId}`,
      before: {
        default_commission_type: currentPartner.default_commission_type,
        default_commission_value: currentPartner.default_commission_value
      },
      after: updateData,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')
    });

    console.log(`[Platform Partner Update Commission] Updated default commission for partner ${partnerId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Partner commission updated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Platform Partner Update Commission] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
