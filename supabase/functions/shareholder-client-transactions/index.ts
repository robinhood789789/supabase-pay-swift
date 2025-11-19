import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Authenticate shareholder
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('ไม่พบ authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('ไม่มีสิทธิ์เข้าถึง');

    // Verify user is an active shareholder
    const { data: shareholder, error: shareholderError } = await supabaseClient
      .from('shareholders')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (shareholderError || !shareholder) {
      throw new Error('ไม่ใช่ผู้ถือหุ้นที่ใช้งานอยู่');
    }

    // Parse request body for filters
    const body = await req.json().catch(() => ({}));
    const { tenant_id, limit = 50, offset = 0 } = body;

    // Get tenant IDs that this shareholder manages
    let tenantIds: string[] = [];
    
    if (tenant_id) {
      // Verify shareholder has access to this specific tenant
      const { data: clientCheck, error: clientCheckError } = await supabaseClient
        .from('shareholder_clients')
        .select('tenant_id')
        .eq('shareholder_id', shareholder.id)
        .eq('tenant_id', tenant_id)
        .single();

      if (clientCheckError || !clientCheck) {
        throw new Error('ไม่มีสิทธิ์เข้าถึงข้อมูลลูกค้ารายนี้');
      }
      
      tenantIds = [tenant_id];
    } else {
      // Get all tenants managed by this shareholder
      const { data: clients, error: clientsError } = await supabaseClient
        .from('shareholder_clients')
        .select('tenant_id')
        .eq('shareholder_id', shareholder.id);

      if (clientsError) throw clientsError;
      tenantIds = clients.map(c => c.tenant_id);
    }

    if (tenantIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          data: {
            transactions: [],
            total: 0
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transactions for these tenants
    const { data: transactions, error: transactionsError } = await supabaseClient
      .from('payments')
      .select(`
        id,
        amount,
        currency,
        status,
        method,
        created_at,
        paid_at,
        tenant_id,
        tenants!inner (
          id,
          name,
          public_id
        )
      `)
      .in('tenant_id', tenantIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (transactionsError) throw transactionsError;

    // Get total count
    const { count, error: countError } = await supabaseClient
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .in('tenant_id', tenantIds);

    if (countError) throw countError;

    // Calculate commission for each transaction
    const { data: commissionRates, error: ratesError } = await supabaseClient
      .from('shareholder_clients')
      .select('tenant_id, commission_rate')
      .eq('shareholder_id', shareholder.id)
      .in('tenant_id', tenantIds);

    if (ratesError) throw ratesError;

    const ratesMap = new Map(
      commissionRates.map(r => [r.tenant_id, r.commission_rate])
    );

    const enrichedTransactions = transactions.map(t => ({
      ...t,
      commission_rate: ratesMap.get(t.tenant_id) || 0,
      commission_amount: (t.amount / 100) * (ratesMap.get(t.tenant_id) || 0) / 100
    }));

    return new Response(
      JSON.stringify({ 
        data: {
          transactions: enrichedTransactions,
          total: count || 0
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in shareholder-client-transactions:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
