import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { 
  verifyWebhookSignature, 
  isEventProcessed, 
  storeProviderEvent,
  enqueueWebhookEvents 
} from "../_shared/webhook-security.ts";
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { handleEnhancedError, ValidationError, ExternalServiceError } from '../_shared/enhanced-errors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<Stripe.Event | null> {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return null;
  }
}

async function processPaymentEvent(
  supabase: any,
  event: Stripe.Event,
  tenantId: string,
  logger: any
) {
  const eventType = event.type;
  const data = event.data.object as any;

  logger.info('Processing Stripe event', { eventType, tenantId, eventId: event.id });

  // Find checkout session by provider_session_id
  const { data: session } = await supabase
    .from("checkout_sessions")
    .select("*")
    .eq("provider_session_id", data.id)
    .eq("tenant_id", tenantId)
    .single();

  if (!session) {
    logger.warn("No checkout session found", { providerSessionId: data.id });
    return;
  }
  
  logger.info('Checkout session found', { sessionId: session.id, status: session.status });

  let paymentStatus = session.status;
  let paidAt: string | undefined;
  let providerPaymentId = data.id;

  // Map Stripe event to payment status
  if (eventType === "checkout.session.completed" || eventType === "payment_intent.succeeded") {
    paymentStatus = "completed";
    paidAt = new Date().toISOString();
  } else if (eventType === "checkout.session.expired" || eventType === "payment_intent.canceled") {
    paymentStatus = "expired";
  } else if (eventType === "payment_intent.payment_failed") {
    paymentStatus = "failed";
  }

  // Update checkout session
  const { data: beforeSession } = await supabase
    .from("checkout_sessions")
    .select("*")
    .eq("id", session.id)
    .single();

  await supabase
    .from("checkout_sessions")
    .update({ status: paymentStatus })
    .eq("id", session.id);

  // Create or update payment record
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("*")
    .eq("checkout_session_id", session.id)
    .single();

  let payment;
  if (existingPayment) {
    const { data: beforePayment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", existingPayment.id)
      .single();

    const { data: updated } = await supabase
      .from("payments")
      .update({
        status: paymentStatus,
        paid_at: paidAt,
        metadata: data,
      })
      .eq("id", existingPayment.id)
      .select()
      .single();

    payment = updated;
    
    logger.info('Payment updated', { paymentId: existingPayment.id, status: paymentStatus });

    // Audit log for payment update
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      action: "payment.updated",
      target: `payment:${existingPayment.id}`,
      before: beforePayment,
      after: updated,
    });
  } else {
    const { data: created } = await supabase
      .from("payments")
      .insert({
        tenant_id: tenantId,
        checkout_session_id: session.id,
        amount: session.amount,
        currency: session.currency,
        status: paymentStatus,
        provider: "stripe",
        provider_payment_id: providerPaymentId,
        paid_at: paidAt,
        metadata: data,
      })
      .select()
      .single();

    payment = created;
    
    logger.info('Payment created', { paymentId: created.id, amount: session.amount, status: paymentStatus });

    // Audit log for payment creation
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      action: "payment.created",
      target: `payment:${created.id}`,
      after: created,
    });
  }

  // Audit log for session status change
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    action: "checkout_session.status_changed",
    target: `checkout_session:${session.id}`,
    before: beforeSession,
    after: { ...session, status: paymentStatus },
  });

    // Enqueue webhook events using shared library
    if (tenantId) {
      await enqueueWebhookEvents(
        supabase,
        tenantId,
        event.type,
        'stripe',
        {
          event_type: event.type,
          provider: "stripe",
          checkout_session: session,
          payment: payment,
          raw_event: data,
        }
      );
      logger.info('Webhook events enqueued', { tenantId, eventType: event.type });
    }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = createLogger('webhooks-stripe');
  const requestContext = extractRequestContext(req);
  logger.setContext(requestContext);

  try {
    logger.logRequest(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get raw payload for signature verification
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET not configured");
      throw new ValidationError("Webhook secret not configured");
    }

    // Verify signature using shared library
    const verifyResult = await verifyWebhookSignature('stripe', payload, signature, webhookSecret);
    if (!verifyResult.valid) {
      logger.error('Signature verification failed', { error: verifyResult.error });
      throw new ValidationError(verifyResult.error || 'Invalid signature');
    }
    
    logger.info('Webhook signature verified');

    // Parse Stripe event from payload
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });
    const event = stripe.webhooks.constructEvent(payload, signature!, webhookSecret);

    logger.info('Stripe webhook event verified', { eventType: event.type, eventId: event.id });

    // Check for duplicate event using shared library
    if (await isEventProcessed(supabase, 'stripe', event.id)) {
      logger.info('Event already processed (idempotency check)', { eventId: event.id });
      logger.logResponse(200, { received: true, message: "Event already processed" });
      return new Response(
        JSON.stringify({ received: true, message: "Event already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store event using shared library
    await storeProviderEvent(supabase, 'stripe', event.id, event.type, event);

    // Extract tenant_id from metadata
    const data = event.data.object as any;
    const tenantId = data.metadata?.tenant_id;

    if (!tenantId) {
      logger.warn("No tenant_id in event metadata, skipping processing");
      logger.logResponse(200, { received: true });
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logger.setContext({ tenantId });

    // Process the event
    await processPaymentEvent(supabase, event, tenantId, logger);

    logger.info('Webhook processing completed successfully');
    logger.logResponse(200, { received: true });
    
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
