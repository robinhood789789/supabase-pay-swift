import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processWebhookWithRetry, calculateBackoffDelay } from '../_shared/webhook-security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

/**
 * Background worker to retry failed webhooks with exponential backoff
 * This should be invoked periodically (e.g., via cron)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get queued webhooks that are ready for retry
    const now = new Date();
    const { data: queuedEvents } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('status', 'queued')
      .lt('attempts', 5)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!queuedEvents || queuedEvents.length === 0) {
      console.log('[Webhook Worker] No queued events to process');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No events to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const event of queuedEvents) {
      // Calculate backoff delay based on attempt number
      const backoffMs = calculateBackoffDelay(event.attempts);
      const nextRetryTime = new Date(event.created_at);
      nextRetryTime.setMilliseconds(nextRetryTime.getMilliseconds() + backoffMs);

      // Skip if not yet time to retry
      if (nextRetryTime > now) {
        console.log(`[Webhook Worker] Event ${event.id} not ready for retry (backoff: ${backoffMs}ms)`);
        continue;
      }

      console.log(`[Webhook Worker] Processing event ${event.id}, attempt ${event.attempts + 1}`);

      try {
        const result = await processWebhookWithRetry(supabase, event.id);
        
        if (result.success) {
          succeeded++;
          console.log(`[Webhook Worker] Event ${event.id} delivered successfully`);
        } else if (result.shouldRetry) {
          console.log(`[Webhook Worker] Event ${event.id} failed, will retry: ${result.error}`);
        } else {
          failed++;
          console.log(`[Webhook Worker] Event ${event.id} failed permanently: ${result.error}`);
        }

        processed++;

        // Rate limiting: small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[Webhook Worker] Error processing event ${event.id}:`, error);
        failed++;
      }
    }

    const summary = {
      processed,
      succeeded,
      failed,
      queued: queuedEvents.length - processed
    };

    console.log('[Webhook Worker] Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[Webhook Worker] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
