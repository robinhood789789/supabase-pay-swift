import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Super Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch partner-related platform settings
    const { data: settings, error: settingsError } = await supabase
      .from('platform_settings')
      .select('*')
      .in('category', ['partner', 'commission'])
      .order('category', { ascending: true })
      .order('setting_key', { ascending: true });

    if (settingsError) throw settingsError;

    // Transform to key-value map
    const settingsMap: Record<string, any> = {};
    settings?.forEach((s) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    // Default values if not set
    const config = {
      revenue_share_base: settingsMap.partner_revenue_share_base || 'platform_fee',
      bounty_trigger: settingsMap.partner_bounty_trigger || 'owner_created',
      max_commission_percent: settingsMap.partner_max_commission_percent || 30,
      settlement_window_days: settingsMap.partner_settlement_window_days || 7,
      allow_self_adjust: settingsMap.partner_allow_self_adjust || false,
      self_adjust_min_percent: settingsMap.partner_self_adjust_min_percent || 5,
      self_adjust_max_percent: settingsMap.partner_self_adjust_max_percent || 20,
      require_approval_threshold_percent: settingsMap.partner_require_approval_threshold_percent || 15,
      dual_control_payout: settingsMap.partner_dual_control_payout || true,
    };

    await supabase.from('audit_logs').insert({
      action: 'platform.partner_settings.view',
      actor_user_id: user.id,
    });

    return new Response(JSON.stringify({ settings: config }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in platform-partner-settings-get:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
