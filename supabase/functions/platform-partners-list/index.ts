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

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
    const status = url.searchParams.get('status');
    const commissionType = url.searchParams.get('commissionType');

    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabase
      .from('shareholders')
      .select('*, shareholder_clients(count)', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (commissionType) {
      query = query.eq('default_commission_type', commissionType);
    }

    query = query.range(offset, offset + pageSize - 1).order('created_at', { ascending: false });

    const { data: partners, error: partnersError, count } = await query;

    if (partnersError) throw partnersError;

    // Calculate KPIs for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: monthlyEvents } = await supabase
      .from('shareholder_commission_events')
      .select('base_value, commission_amount')
      .gte('occurred_at', startOfMonth.toISOString());

    const monthlyBase = monthlyEvents?.reduce((sum, e) => sum + Number(e.base_value), 0) || 0;
    const monthlyCommission = monthlyEvents?.reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;

    // Total pending (from all partners)
    const { data: balances } = await supabase
      .from('shareholders')
      .select('balance');

    const totalPending = balances?.reduce((sum, b) => sum + Number(b.balance), 0) || 0;

    // Active clients count
    const { count: activeClientsCount } = await supabase
      .from('shareholder_clients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Enrich partners with monthly stats
    const enrichedPartners = await Promise.all(
      (partners || []).map(async (partner) => {
        const { data: monthlyPartnerEvents } = await supabase
          .from('shareholder_commission_events')
          .select('base_value, commission_amount')
          .eq('shareholder_id', partner.id)
          .gte('occurred_at', startOfMonth.toISOString());

        const monthlyPartnerBase = monthlyPartnerEvents?.reduce((sum, e) => sum + Number(e.base_value), 0) || 0;
        const monthlyPartnerCommission = monthlyPartnerEvents?.reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;

        return {
          ...partner,
          monthly_base: monthlyPartnerBase,
          monthly_commission: monthlyPartnerCommission,
        };
      })
    );

    console.log(`[Platform Partners] Fetched ${partners?.length || 0} partners (page ${page})`);

    return new Response(
      JSON.stringify({
        partners: enrichedPartners,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
        kpis: {
          monthly_base: monthlyBase,
          monthly_commission: monthlyCommission,
          total_pending: totalPending,
          active_clients: activeClientsCount || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Platform Partners] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
