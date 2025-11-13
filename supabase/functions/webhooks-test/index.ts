import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

// Generate HMAC signature
const generateHmacSignature = async (payload: string, secret: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tenant from header
    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'X-Tenant header required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { webhook_id } = await req.json();
    if (!webhook_id) {
      return new Response(
        JSON.stringify({ error: 'webhook_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Testing webhook:', webhook_id);

    // Get webhook details
    const { data: webhook, error: webhookError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhook_id)
      .eq('tenant_id', tenantId)
      .eq('enabled', true)
      .single();

    if (webhookError || !webhook) {
      return new Response(
        JSON.stringify({ error: 'Webhook not found or disabled' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create sample payload
    const samplePayload = {
      event: 'payment.test',
      data: {
        id: crypto.randomUUID(),
        amount: 10000,
        currency: 'THB',
        status: 'succeeded',
        created_at: new Date().toISOString()
      },
      created: Math.floor(Date.now() / 1000)
    };

    const payloadString = JSON.stringify(samplePayload);
    
    // Generate signature
    const signature = await generateHmacSignature(payloadString, webhook.secret);

    console.log('Sending test webhook to:', webhook.url);

    // Send webhook (with retry logic in background)
    const sendWebhook = async (attempt: number = 1): Promise<{success: boolean, statusCode?: number, error?: string}> => {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': Date.now().toString(),
            'User-Agent': 'PaymentGateway-Webhook/1.0'
          },
          body: payloadString,
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        return {
          success: response.ok,
          statusCode: response.status
        };
      } catch (error) {
        console.error(`Webhook attempt ${attempt} failed:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    // First attempt
    const result = await sendWebhook(1);

    // Queue webhook event for retry if failed
    if (!result.success) {
      console.log('Queueing webhook event for retry');
      await supabase.from('webhook_events').insert({
        tenant_id: tenantId,
        provider: 'test',
        event_type: 'payment.test',
        payload: samplePayload,
        status: 'queued',
        attempts: 1,
        last_error: result.error || `HTTP ${result.statusCode}`
      });
    }

    // Log to audit_logs
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'webhook.tested',
      target: `webhook:${webhook.id}`,
      after: {
        webhook_id: webhook.id,
        url: webhook.url,
        success: result.success,
        status_code: result.statusCode
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        test_result: {
          webhook_id: webhook.id,
          url: webhook.url,
          sent: true,
          response_status: result.statusCode,
          signature,
          payload: samplePayload,
          delivered: result.success,
          error: result.error
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
