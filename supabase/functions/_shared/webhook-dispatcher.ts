import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { createLogger } from './logger.ts';

const logger = createLogger('webhook-dispatcher');

// Standard webhook payload structure
export interface WebhookPayload {
  id: string;
  event: string;
  created: number;
  data: {
    object: any;
  };
  metadata?: Record<string, any>;
}

// Webhook delivery result
export interface WebhookDeliveryResult {
  webhook_id: string;
  success: boolean;
  response_status?: number;
  response_body?: string;
  error_message?: string;
  delivered_at?: string;
}

// Generate HMAC signature for webhook
export async function generateWebhookSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

// Get active webhooks subscribed to an event
export async function getSubscribedWebhooks(
  supabase: SupabaseClient,
  tenantId: string,
  eventType: string
): Promise<any[]> {
  logger.info('Fetching subscribed webhooks', {
    tenant_id: tenantId,
    event_type: eventType,
  });

  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  if (error) {
    logger.error('Failed to fetch webhooks', error);
    throw error;
  }

  // Filter webhooks that are subscribed to this event type
  const subscribedWebhooks = data.filter((webhook) => {
    const events = webhook.events || [];
    return events.includes(eventType) || events.includes('*');
  });

  logger.info(`Found ${subscribedWebhooks.length} subscribed webhooks`);
  return subscribedWebhooks;
}

// Send webhook to a single endpoint
export async function sendWebhook(
  webhook: any,
  payload: WebhookPayload,
  tenantId: string
): Promise<WebhookDeliveryResult> {
  const webhookId = webhook.id;
  const url = webhook.url;
  const secret = webhook.secret;

  logger.info('Sending webhook', {
    webhook_id: webhookId,
    url: url,
    event: payload.event,
  });

  try {
    // Prepare payload
    const payloadString = JSON.stringify(payload);

    // Generate signature
    const signature = await generateWebhookSignature(payloadString, secret);
    const timestamp = Math.floor(Date.now() / 1000);

    // Send HTTP request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Event': payload.event,
        'User-Agent': 'PayX-Webhooks/1.0',
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseBody = await response.text();
    const success = response.ok;

    logger.info('Webhook response received', {
      webhook_id: webhookId,
      status: response.status,
      success,
    });

    return {
      webhook_id: webhookId,
      success,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000), // Limit response body length
      delivered_at: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error('Webhook delivery failed', error, {
      webhook_id: webhookId,
      url: url,
    });

    return {
      webhook_id: webhookId,
      success: false,
      error_message: error.message || 'Unknown error',
    };
  }
}

// Dispatch event to all subscribed webhooks
export async function dispatchWebhookEvent(
  supabase: SupabaseClient,
  tenantId: string,
  eventType: string,
  eventData: any,
  metadata?: Record<string, any>
): Promise<WebhookDeliveryResult[]> {
  logger.info('Dispatching webhook event', {
    tenant_id: tenantId,
    event_type: eventType,
  });

  // Get subscribed webhooks
  const webhooks = await getSubscribedWebhooks(supabase, tenantId, eventType);

  if (webhooks.length === 0) {
    logger.info('No webhooks subscribed to this event');
    return [];
  }

  // Prepare standard payload
  const payload: WebhookPayload = {
    id: `evt_${crypto.randomUUID()}`,
    event: eventType,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: eventData,
    },
    metadata,
  };

  // Send to all webhooks in parallel
  const deliveryPromises = webhooks.map((webhook) =>
    sendWebhook(webhook, payload, tenantId)
  );

  const results = await Promise.all(deliveryPromises);

  // Log all webhook events to database
  const eventLogs = results.map((result) => ({
    webhook_id: result.webhook_id,
    tenant_id: tenantId,
    event_type: eventType,
    payload: payload,
    response_status: result.response_status,
    response_body: result.response_body,
    error_message: result.error_message,
    success: result.success,
    delivered_at: result.delivered_at,
    retry_count: 0,
  }));

  // Insert logs in batch
  const { error: logError } = await supabase
    .from('webhook_events')
    .insert(eventLogs);

  if (logError) {
    logger.error('Failed to log webhook events', logError);
  }

  // Update webhook success/failure counts
  for (const result of results) {
    const updateField = result.success ? 'success_count' : 'failure_count';
    await supabase.rpc('increment', {
      table_name: 'webhooks',
      row_id: result.webhook_id,
      column_name: updateField,
    });

    // Update last_triggered_at
    await supabase
      .from('webhooks')
      .update({ last_triggered_at: new Date().toISOString() })
      .eq('id', result.webhook_id);
  }

  logger.info('Webhook event dispatched', {
    total: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  });

  return results;
}

// Retry failed webhook delivery
export async function retryWebhookDelivery(
  supabase: SupabaseClient,
  webhookEventId: string
): Promise<WebhookDeliveryResult> {
  logger.info('Retrying webhook delivery', { webhook_event_id: webhookEventId });

  // Get webhook event
  const { data: event, error: eventError } = await supabase
    .from('webhook_events')
    .select('*, webhooks(*)')
    .eq('id', webhookEventId)
    .single();

  if (eventError || !event) {
    throw new Error('Webhook event not found');
  }

  // Check retry limit
  if (event.retry_count >= 3) {
    throw new Error('Maximum retry attempts reached');
  }

  // Send webhook
  const result = await sendWebhook(
    event.webhooks,
    event.payload,
    event.tenant_id
  );

  // Update webhook event
  await supabase
    .from('webhook_events')
    .update({
      retry_count: event.retry_count + 1,
      success: result.success,
      response_status: result.response_status,
      response_body: result.response_body,
      error_message: result.error_message,
      delivered_at: result.delivered_at,
    })
    .eq('id', webhookEventId);

  return result;
}
