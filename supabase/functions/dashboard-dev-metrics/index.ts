import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

interface DevMetrics {
  api_success_rate: number;
  latency_p50: number;
  latency_p95: number;
  http_4xx: number;
  http_5xx: number;
  webhook_success_rate: number;
  recent_deliveries: Array<{
    id: string;
    endpoint: string;
    status: string;
    created_at: string;
    attempts: number;
  }>;
  active_api_keys: number;
  expiring_soon: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenant ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get API keys stats
    const { data: apiKeys } = await supabaseClient
      .from('api_keys')
      .select('id, expires_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    const activeApiKeys = apiKeys?.length || 0;
    const expiringThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = apiKeys?.filter(k => 
      k.expires_at && new Date(k.expires_at) < expiringThreshold
    ).length || 0;

    // Get webhook delivery stats (last 24h)
    const { data: webhookEvents } = await supabaseClient
      .from('webhook_events')
      .select('id, endpoint, status, created_at, attempts')
      .eq('tenant_id', tenantId)
      .gte('created_at', last24h.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    const webhookSuccessCount = webhookEvents?.filter(e => e.status === 'delivered').length || 0;
    const webhookTotalCount = webhookEvents?.length || 0;
    const webhookSuccessRate = webhookTotalCount > 0 
      ? Math.round((webhookSuccessCount / webhookTotalCount) * 100) 
      : 100;

    const recentDeliveries = (webhookEvents || []).slice(0, 10).map(e => ({
      id: e.id,
      endpoint: e.endpoint || 'N/A',
      status: e.status,
      created_at: e.created_at,
      attempts: e.attempts || 0,
    }));

    // Simulated API metrics (would need audit_logs or separate metrics table in production)
    const { data: auditLogs } = await supabaseClient
      .from('audit_logs')
      .select('action, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', last24h.toISOString());

    const apiCalls = auditLogs?.length || 0;
    const apiSuccessRate = apiCalls > 0 ? 98 : 100; // Mock: assume 98% success
    const http4xx = Math.floor(apiCalls * 0.01); // Mock: 1% client errors
    const http5xx = Math.floor(apiCalls * 0.01); // Mock: 1% server errors

    // Mock latency (would need real APM in production)
    const latencyP50 = 120; // ms
    const latencyP95 = 450; // ms

    const metrics: DevMetrics = {
      api_success_rate: apiSuccessRate,
      latency_p50: latencyP50,
      latency_p95: latencyP95,
      http_4xx: http4xx,
      http_5xx: http5xx,
      webhook_success_rate: webhookSuccessRate,
      recent_deliveries: recentDeliveries,
      active_api_keys: activeApiKeys,
      expiring_soon: expiringSoon,
    };

    console.log('Dev metrics fetched:', { tenantId, metrics });

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching dev metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
