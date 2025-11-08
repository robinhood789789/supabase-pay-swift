import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    const url = new URL(req.url);
    const startDate = url.searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = url.searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const groupBy = url.searchParams.get('group_by') || 'day'; // day, month, partner
    const partnerId = url.searchParams.get('partner_id');

    // Fetch commission events
    let query = supabase
      .from('shareholder_commission_events')
      .select(`
        *,
        shareholder:shareholders(id, user_id, full_name),
        tenant:tenants(id, name)
      `)
      .gte('occurred_at', startDate)
      .lte('occurred_at', endDate + 'T23:59:59');

    if (partnerId) {
      query = query.eq('shareholder_id', partnerId);
    }

    const { data: events, error: eventsError } = await query.order('occurred_at', { ascending: false });

    if (eventsError) throw eventsError;

    // Calculate aggregates
    const totalBaseValue = events?.reduce((sum, e) => sum + parseFloat(e.base_value || 0), 0) || 0;
    const totalCommission = events?.reduce((sum, e) => sum + parseFloat(e.commission_amount || 0), 0) || 0;
    const netToPlatform = totalBaseValue - totalCommission;

    // Group by requested dimension
    let groupedData: any[] = [];
    if (groupBy === 'partner') {
      const byPartner = events?.reduce((acc: any, e) => {
        const pid = e.shareholder_id;
        if (!acc[pid]) {
          acc[pid] = {
            partner_id: pid,
            partner_name: e.shareholder?.full_name || 'Unknown',
            base_value: 0,
            commission: 0,
            event_count: 0,
          };
        }
        acc[pid].base_value += parseFloat(e.base_value || 0);
        acc[pid].commission += parseFloat(e.commission_amount || 0);
        acc[pid].event_count += 1;
        return acc;
      }, {});
      groupedData = Object.values(byPartner || {});
    } else if (groupBy === 'day' || groupBy === 'month') {
      const byDate = events?.reduce((acc: any, e) => {
        const date = new Date(e.occurred_at);
        const key = groupBy === 'day'
          ? date.toISOString().split('T')[0]
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[key]) {
          acc[key] = { date: key, base_value: 0, commission: 0, event_count: 0 };
        }
        acc[key].base_value += parseFloat(e.base_value || 0);
        acc[key].commission += parseFloat(e.commission_amount || 0);
        acc[key].event_count += 1;
        return acc;
      }, {});
      groupedData = Object.values(byDate || {}).sort((a: any, b: any) => a.date.localeCompare(b.date));
    }

    // Fetch pending payouts
    const { data: pendingPayouts } = await supabase
      .from('shareholder_withdrawals')
      .select('amount')
      .in('status', ['pending', 'approved']);

    const totalPending = pendingPayouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    await supabase.from('audit_logs').insert({
      action: 'platform.partner_reports.view',
      actor_user_id: user.id,
      after: { start_date: startDate, end_date: endDate, group_by: groupBy, partner_id: partnerId },
    });

    return new Response(
      JSON.stringify({
        summary: {
          total_base_value: totalBaseValue,
          total_commission: totalCommission,
          net_to_platform: netToPlatform,
          total_pending: totalPending,
          event_count: events?.length || 0,
        },
        grouped_data: groupedData,
        events: events?.slice(0, 100), // Limit to 100 for detail view
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in platform-partner-reports-get:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
