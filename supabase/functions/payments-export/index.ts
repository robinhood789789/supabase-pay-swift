import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const tenantId = req.headers.get('X-Tenant');
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Missing X-Tenant header' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { filters } = await req.json();

    let query = supabase
      .from("payments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters?.method && filters.method !== "all") {
      query = query.eq("method", filters.method);
    }

    if (filters?.minAmount) {
      query = query.gte("amount", parseInt(filters.minAmount) * 100);
    }

    if (filters?.maxAmount) {
      query = query.lte("amount", parseInt(filters.maxAmount) * 100);
    }

    if (filters?.dateFrom) {
      query = query.gte("created_at", new Date(filters.dateFrom).toISOString());
    }

    if (filters?.dateTo) {
      const endOfDay = new Date(filters.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endOfDay.toISOString());
    }

    const { data: payments, error } = await query;

    if (error) throw error;

    // Generate CSV
    const headers = ['ID', 'Amount', 'Currency', 'Status', 'Method', 'Provider', 'Created At', 'Paid At'];
    const rows = payments.map(p => [
      p.id,
      (p.amount / 100).toString(),
      p.currency,
      p.status,
      p.method || '',
      p.provider || '',
      p.created_at,
      p.paid_at || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payments-export.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
