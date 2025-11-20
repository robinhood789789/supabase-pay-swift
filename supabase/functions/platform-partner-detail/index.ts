import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant, x-csrf-token, cookie',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    
    // Try to get partnerId from body first, then fall back to query parameter
    let partnerId: string | null = null;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        partnerId = body.partnerId;
      } catch (e) {
        // If body parsing fails, try query parameter
        partnerId = url.searchParams.get('partnerId');
      }
    } else {
      partnerId = url.searchParams.get('partnerId');
    }

    if (!partnerId) {
      return new Response(
        JSON.stringify({ error: 'Missing partnerId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get partner details
    const { data: partner, error: partnerError } = await supabase
      .from('shareholders')
      .select('*')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      return new Response(
        JSON.stringify({ error: 'Partner not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get linked tenants
    const { data: linkedTenants, error: tenantsError } = await supabase
      .from('shareholder_clients')
      .select(`
        *,
        tenants (
          id,
          name,
          status,
          kyc_status
        )
      `)
      .eq('shareholder_id', partnerId)
      .order('referred_at', { ascending: false });

    if (tenantsError) throw tenantsError;

    // Get pending adjust requests (optional - table may not exist in some environments)
    const { data: adjustRequests, error: requestsError } = await supabase
      .from('shareholder_adjust_requests')
      .select(`
        *,
        tenants:tenant_id (name)
      `)
      .eq('shareholder_id', partnerId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    // If the table doesn't exist or any other error occurs, just skip adjust requests
    if (requestsError) {
      console.warn('[Platform Partner Detail] Adjust requests not available:', requestsError.message || requestsError);
    }

    // Get commission events (last 100) (optional - table may not exist in some environments)
    const { data: commissionEvents, error: eventsError } = await supabase
      .from('shareholder_commission_events')
      .select(`
        *,
        tenants:tenant_id (name)
      `)
      .eq('shareholder_id', partnerId)
      .order('occurred_at', { ascending: false })
      .limit(100);

    // If commission events table is missing or query fails, log and continue
    if (eventsError) {
      console.warn('[Platform Partner Detail] Commission events not available:', eventsError.message || eventsError);
    }

    // Get payout history
    const { data: payouts, error: payoutsError } = await supabase
      .from('shareholder_withdrawals')
      .select('*')
      .eq('shareholder_id', partnerId)
      .order('requested_at', { ascending: false })
      .limit(50);

    if (payoutsError) throw payoutsError;

    // Calculate monthly and yearly earnings
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const { data: monthlyEvents } = await supabase
      .from('shareholder_commission_events')
      .select('base_value, commission_amount')
      .eq('shareholder_id', partnerId)
      .gte('occurred_at', startOfMonth.toISOString());

    const { data: yearlyEvents } = await supabase
      .from('shareholder_commission_events')
      .select('base_value, commission_amount')
      .eq('shareholder_id', partnerId)
      .gte('occurred_at', startOfYear.toISOString());

    const monthlyBase = monthlyEvents?.reduce((sum, e) => sum + Number(e.base_value), 0) || 0;
    const monthlyCommission = monthlyEvents?.reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;
    const yearlyBase = yearlyEvents?.reduce((sum, e) => sum + Number(e.base_value), 0) || 0;
    const yearlyCommission = yearlyEvents?.reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;

    console.log(`[Platform Partner Detail] Fetched details for partner ${partnerId}`);

    return new Response(
      JSON.stringify({
        partner,
        linkedTenants: linkedTenants || [],
        adjustRequests: adjustRequests || [],
        commissionEvents: commissionEvents || [],
        payouts: payouts || [],
        kpis: {
          monthly_base: monthlyBase,
          monthly_commission: monthlyCommission,
          yearly_base: yearlyBase,
          yearly_commission: yearlyCommission,
          balance: partner.balance || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Platform Partner Detail] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
