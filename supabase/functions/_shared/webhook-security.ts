import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  shouldRetry: boolean;
  error?: string;
}

/**
 * Verify raw webhook signature from provider
 */
export async function verifyWebhookSignature(
  provider: string,
  payload: string,
  signature: string | null,
  secret: string
): Promise<WebhookVerificationResult> {
  if (!signature) {
    return { valid: false, error: 'Missing signature header' };
  }

  try {
    switch (provider) {
      case 'stripe':
        return await verifyStripeSignature(payload, signature, secret);
      
      case 'kbank':
        return await verifyKBankSignature(payload, signature, secret);
      
      case 'opn':
      case '2c2p':
        return await verifyHMACSignature(payload, signature, secret);
      
      default:
        return { valid: false, error: 'Unknown provider' };
    }
  } catch (error) {
    console.error('Signature verification error:', error);
    return { valid: false, error: (error as Error).message };
  }
}

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<WebhookVerificationResult> {
  // Stripe uses timestamp + payload HMAC
  const timestamp = signature.split(',').find(part => part.startsWith('t='))?.slice(2);
  const sig = signature.split(',').find(part => part.startsWith('v1='))?.slice(3);
  
  if (!timestamp || !sig) {
    return { valid: false, error: 'Invalid stripe signature format' };
  }

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(signature_bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const isValid = expected === sig;
  
  // Check timestamp tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const timestampNum = parseInt(timestamp);
  if (Math.abs(now - timestampNum) > 300) {
    return { valid: false, error: 'Timestamp outside tolerance window' };
  }

  return { valid: isValid, error: isValid ? undefined : 'Signature mismatch' };
}

async function verifyKBankSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<WebhookVerificationResult> {
  // KBank typically uses HMAC-SHA256
  return await verifyHMACSignature(payload, signature, secret);
}

async function verifyHMACSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<WebhookVerificationResult> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signature_bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const isValid = expected.toLowerCase() === signature.toLowerCase();
  return { valid: isValid, error: isValid ? undefined : 'Signature mismatch' };
}

/**
 * Check if webhook event has already been processed (idempotency)
 */
export async function isEventProcessed(
  supabase: any,
  provider: string,
  eventId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('provider_events')
    .select('id')
    .eq('event_id', eventId)
    .eq('provider', provider)
    .single();
  
  return !!data;
}

/**
 * Store webhook event for idempotency and replay
 */
export async function storeProviderEvent(
  supabase: any,
  provider: string,
  eventId: string,
  eventType: string,
  payload: any
): Promise<void> {
  await supabase.from('provider_events').insert({
    event_id: eventId,
    provider,
    type: eventType,
    payload,
  });
}

/**
 * Enqueue webhook events for tenant webhooks with retry logic
 */
export async function enqueueWebhookEvents(
  supabase: any,
  tenantId: string,
  eventType: string,
  provider: string,
  payload: any
): Promise<void> {
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  if (!webhooks || webhooks.length === 0) {
    return;
  }

  const events = webhooks.map((webhook: any) => ({
    tenant_id: tenantId,
    event_type: eventType,
    provider,
    payload,
    status: 'queued',
    attempts: 0,
  }));

  await supabase.from('webhook_events').insert(events);
  console.log(`[Webhook] Enqueued ${events.length} events for tenant ${tenantId}`);
}

/**
 * Process webhook event with retry logic and DLQ
 */
export async function processWebhookWithRetry(
  supabase: any,
  eventId: string
): Promise<WebhookProcessingResult> {
  const { data: event } = await supabase
    .from('webhook_events')
    .select('*, webhooks!inner(*)')
    .eq('id', eventId)
    .single();

  if (!event) {
    return { success: false, shouldRetry: false, error: 'Event not found' };
  }

  const maxAttempts = 5;
  const currentAttempt = event.attempts + 1;

  try {
    const webhook = event.webhooks;
    
    // Create HMAC signature for tenant webhook
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhook.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const payloadStr = JSON.stringify(event.payload);
    const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
    const signature = Array.from(new Uint8Array(signature_bytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Call tenant webhook
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event-Type': event.event_type,
        'X-Webhook-Provider': event.provider,
      },
      body: payloadStr,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (response.ok) {
      // Success
      await supabase
        .from('webhook_events')
        .update({ status: 'delivered', attempts: currentAttempt })
        .eq('id', eventId);
      
      return { success: true, shouldRetry: false };
    } else {
      // HTTP error
      const errorText = await response.text();
      await supabase
        .from('webhook_events')
        .update({
          status: currentAttempt >= maxAttempts ? 'failed' : 'queued',
          attempts: currentAttempt,
          last_error: `HTTP ${response.status}: ${errorText.substring(0, 255)}`,
        })
        .eq('id', eventId);

      return {
        success: false,
        shouldRetry: currentAttempt < maxAttempts,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    console.error('[Webhook] Delivery error:', error);
    
    const errorMessage = (error as Error).message.substring(0, 255);
    await supabase
      .from('webhook_events')
      .update({
        status: currentAttempt >= maxAttempts ? 'failed' : 'queued',
        attempts: currentAttempt,
        last_error: errorMessage,
      })
      .eq('id', eventId);

    return {
      success: false,
      shouldRetry: currentAttempt < maxAttempts,
      error: errorMessage,
    };
  }
}

/**
 * Calculate exponential backoff delay for webhook retry
 */
export function calculateBackoffDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  return Math.min(1000 * Math.pow(2, attemptNumber), 60000);
}

/**
 * Move failed webhooks to Dead Letter Queue
 */
export async function moveToDLQ(
  supabase: any,
  tenantId: string
): Promise<number> {
  const { data: failedEvents } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'failed')
    .gte('attempts', 5);

  if (!failedEvents || failedEvents.length === 0) {
    return 0;
  }

  // In production, you'd move these to a separate DLQ table
  // For now, we'll just log them
  console.log(`[DLQ] ${failedEvents.length} events moved to DLQ for tenant ${tenantId}`);
  
  return failedEvents.length;
}
