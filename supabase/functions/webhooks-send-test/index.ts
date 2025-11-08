import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { requireStepUp, createMfaError } from "../_shared/mfa-guards.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { webhook_id } = await req.json();

    if (!webhook_id) {
      return new Response(JSON.stringify({ error: 'webhook_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get webhook to find tenant_id
    const { data: webhook, error: webhookError } = await supabaseClient
      .from('webhooks')
      .select('tenant_id')
      .eq('id', webhook_id)
      .single();

    if (webhookError || !webhook) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user role and check MFA
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    const { data: membership } = await supabaseClient
      .from('memberships')
      .select(`
        role_id,
        roles!inner (
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('tenant_id', webhook.tenant_id)
      .single();

    const userRole = (membership?.roles as any)?.name;

    const mfaCheck = await requireStepUp({
      supabase: supabaseClient,
      userId: user.id,
      tenantId: webhook.tenant_id,
      action: 'webhooks',
      userRole,
      isSuperAdmin: profile?.is_super_admin || false,
    });

    if (!mfaCheck.ok) {
      return createMfaError(mfaCheck.code!, mfaCheck.message!);
    }

    // Get webhook details (already fetched above for MFA check)
    const { data: webhookDetails, error: webhookDetailsError } = await supabaseClient
      .from('webhooks')
      .select('*')
      .eq('id', webhook_id)
      .single();

    if (webhookDetailsError || !webhookDetails) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook event',
        webhook_id: webhook_id,
      },
    };

    // Generate signature
    const signature = await generateSignature(JSON.stringify(testPayload), webhookDetails.secret);

    // Send test webhook
    const webhookResponse = await fetch(webhookDetails.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'webhook.test',
      },
      body: JSON.stringify(testPayload),
    });

    const responseText = await webhookResponse.text();
    const success = webhookResponse.ok;

    // Log the test webhook event
    await supabaseClient
      .from('webhook_events')
      .insert({
        tenant_id: webhookDetails.tenant_id,
        event_type: 'webhook.test',
        payload: testPayload,
        status: success ? 'delivered' : 'failed',
        last_error: success ? null : `HTTP ${webhookResponse.status}: ${responseText}`,
      });

    return new Response(JSON.stringify({
      success,
      status: webhookResponse.status,
      response: responseText.slice(0, 500), // Limit response size
      message: success 
        ? 'Test webhook sent successfully' 
        : 'Test webhook failed - check webhook URL and endpoint',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in webhooks-send-test function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: String(error),
      message: 'Failed to send test webhook',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
