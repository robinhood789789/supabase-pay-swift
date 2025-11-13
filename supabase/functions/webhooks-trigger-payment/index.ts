import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { dispatchWebhookEvent } from '../_shared/webhook-dispatcher.ts';

const logger = createLogger('webhooks-trigger-payment');

/**
 * This function listens to payment status changes and automatically
 * dispatches webhook events to subscribed endpoints
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  logger.setContext({ requestId });
  logger.logRequest(req);

  try {
    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body (this would be triggered by a database trigger or internal call)
    const body = await req.json();
    const { type, record } = body;

    logger.info('Processing payment webhook trigger', { type, payment_id: record?.id });

    // Determine event type based on trigger
    let eventType: string;
    let eventData: any;

    switch (type) {
      case 'INSERT':
        if (record.status === 'succeeded') {
          eventType = 'payment.succeeded';
        } else if (record.status === 'failed') {
          eventType = 'payment.failed';
        } else {
          eventType = 'payment.pending';
        }
        break;

      case 'UPDATE':
        if (record.status === 'succeeded') {
          eventType = 'payment.succeeded';
        } else if (record.status === 'failed') {
          eventType = 'payment.failed';
        } else {
          eventType = 'payment.updated';
        }
        break;

      default:
        logger.warn('Unknown trigger type', { type });
        return new Response(JSON.stringify({ success: false, message: 'Unknown trigger type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Format payment data for webhook
    eventData = {
      id: record.id,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      method: record.method,
      provider: record.provider,
      provider_payment_id: record.provider_payment_id,
      created_at: record.created_at,
      paid_at: record.paid_at,
      metadata: record.metadata,
    };

    // Dispatch webhook event
    const results = await dispatchWebhookEvent(
      supabaseClient,
      record.tenant_id,
      eventType,
      eventData,
      {
        trigger_type: type,
        processed_at: new Date().toISOString(),
      }
    );

    logger.info('Payment webhook dispatched', {
      event_type: eventType,
      dispatched: results.length,
      successful: results.filter((r) => r.success).length,
    });

    const response = {
      success: true,
      event_type: eventType,
      dispatched: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };

    logger.logResponse(200, response);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    logger.error('Failed to process payment webhook trigger', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
