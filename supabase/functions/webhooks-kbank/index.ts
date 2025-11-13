import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";
import { WebhookEvent } from "../_shared/types.ts";
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { handleEnhancedError, ValidationError } from '../_shared/enhanced-errors.ts';

async function verifyKBankSignature(
  payload: any,
  signature: string | null,
  logger: any
): Promise<boolean> {
  // TODO: Implement KBank signature verification
  // Use KBank's webhook signature validation method
  logger.warn("KBank signature verification not yet implemented");
  return true; // Stub: accept all for now
}

async function processPaymentEvent(
  supabase: any,
  event: any,
  tenantId: string,
  logger: any
) {
  logger.info('Processing KBank event', { tenantId, eventType: event.status || event.eventType });
  
  // TODO: Implement KBank-specific event processing
  // Map KBank event types to payment statuses
  // Update checkout_sessions and payments tables
  // Write audit_logs
  // Enqueue webhook_events
  
  logger.warn("KBank event processing not fully implemented");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = createLogger('webhooks-kbank');
  const requestContext = extractRequestContext(req);
  logger.setContext(requestContext);

  try {
    logger.logRequest(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    const signature = req.headers.get("x-kbank-signature");

    // Verify signature
    const isValid = await verifyKBankSignature(payload, signature, logger);
    if (!isValid) {
      logger.error('KBank signature verification failed');
      throw new ValidationError('Invalid signature');
    }

    const eventId = payload.transactionId || payload.referenceNo;
    const eventType = payload.status || payload.eventType;

    logger.info('KBank webhook event received', { eventType, eventId });

    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from("provider_events")
      .select("id")
      .eq("event_id", eventId)
      .eq("provider", "kbank")
      .single();

    if (existingEvent) {
      logger.info('Event already processed (idempotency check)', { eventId });
      logger.logResponse(200, { received: true, message: "Event already processed" });
      return new Response(
        JSON.stringify({ received: true, message: "Event already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store provider event
    await supabase.from("provider_events").insert({
      event_id: eventId,
      provider: "kbank",
      type: eventType,
      payload: payload,
    });

    // Extract tenant_id from payload
    const tenantId = payload.metadata?.tenant_id || payload.merchantData;

    if (tenantId) {
      logger.setContext({ tenantId });
      await processPaymentEvent(supabase, payload, tenantId, logger);
      logger.info('KBank event processed successfully');
    } else {
      logger.warn('No tenant_id found in payload');
    }

    logger.logResponse(200, { received: true });
    
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
