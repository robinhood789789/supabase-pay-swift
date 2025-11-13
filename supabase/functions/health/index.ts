import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();
  const checks: Record<string, any> = {};

  try {
    // Database health check
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const dbStart = Date.now();
    const { data: dbTest, error: dbError } = await supabaseClient
      .from('tenants')
      .select('count')
      .limit(1);

    checks.database = {
      status: dbError ? 'unhealthy' : 'healthy',
      latency_ms: Date.now() - dbStart,
      error: dbError?.message || null,
    };

    // Storage health check
    const storageStart = Date.now();
    const { data: buckets, error: storageError } = await supabaseClient
      .storage
      .listBuckets();

    checks.storage = {
      status: storageError ? 'unhealthy' : 'healthy',
      latency_ms: Date.now() - storageStart,
      buckets_count: buckets?.length || 0,
      error: storageError?.message || null,
    };

    // Edge function health
    checks.edge_function = {
      status: 'healthy',
      latency_ms: Date.now() - startTime,
    };

    // Overall health
    const isHealthy = checks.database.status === 'healthy' && 
                      checks.storage.status === 'healthy';

    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks,
      total_latency_ms: Date.now() - startTime,
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: isHealthy ? 200 : 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: String(error),
      checks,
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
