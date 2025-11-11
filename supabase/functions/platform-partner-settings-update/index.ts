import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { requireStepUp } from '../_shared/mfa-guards.ts';
import { requireCSRF } from '../_shared/csrf-validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // CSRF protection
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // MFA step-up required
    const mfaCheck = await requireStepUp({
      supabase,
      userId: user.id,
      action: 'platform.settings.update',
      userRole: 'super_admin',
      isSuperAdmin: true,
    });

    if (!mfaCheck.ok) {
      return new Response(JSON.stringify({ error: mfaCheck.message, code: mfaCheck.code }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { settings } = await req.json();

    if (!settings || typeof settings !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid settings object' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch current settings for audit
    const { data: currentSettings } = await supabase
      .from('platform_settings')
      .select('*')
      .in('category', ['partner', 'commission']);

    const currentMap: Record<string, any> = {};
    currentSettings?.forEach((s) => {
      currentMap[s.setting_key] = s.setting_value;
    });

    // Update each setting
    const updates: any[] = [];
    const settingsToUpdate = [
      { key: 'partner_revenue_share_base', category: 'partner', description: 'Commission calculation base (platform_fee or gross_volume)' },
      { key: 'partner_bounty_trigger', category: 'partner', description: 'Bounty trigger event (owner_created or first_successful_payment)' },
      { key: 'partner_max_commission_percent', category: 'commission', description: 'Maximum commission percentage allowed' },
      { key: 'partner_settlement_window_days', category: 'partner', description: 'Days before commission moves from pending to available' },
      { key: 'partner_allow_self_adjust', category: 'partner', description: 'Allow partners to self-adjust commission rates' },
      { key: 'partner_self_adjust_min_percent', category: 'commission', description: 'Minimum self-adjust commission percentage' },
      { key: 'partner_self_adjust_max_percent', category: 'commission', description: 'Maximum self-adjust commission percentage' },
      { key: 'partner_require_approval_threshold_percent', category: 'commission', description: 'Commission percentage requiring approval' },
      { key: 'partner_dual_control_payout', category: 'partner', description: 'Require dual control for payouts' },
    ];

    for (const setting of settingsToUpdate) {
      const newValue = settings[setting.key.replace('partner_', '')];
      if (newValue !== undefined) {
        const { error } = await supabase
          .from('platform_settings')
          .upsert({
            setting_key: setting.key,
            category: setting.category,
            description: setting.description,
            setting_value: newValue,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'setting_key' });

        if (error) throw error;

        updates.push({
          key: setting.key,
          before: currentMap[setting.key],
          after: newValue,
        });
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'platform.partner_settings.update',
      actor_user_id: user.id,
      before: currentMap,
      after: settings,
    });

    return new Response(
      JSON.stringify({ success: true, updated: updates }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in platform-partner-settings-update:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
