import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { WebhookEvent } from "../_shared/types.ts";

async function verify2C2PSignature(
  payload: any,
  signature: string | null
): Promise<boolean> {
  // TODO: Implement 2C2P signature verification
  // https://developer.2c2p.com/docs/webhook-signature-validation
  console.log("2C2P signature verification not yet implemented");
  return true; // Stub: accept all for now
}

async function processPaymentEvent(
  supabase: any,
  event: any,
  tenantId: string
) {
  console.log(`Processing 2C2P event: ${event.eventType} for tenant ${tenantId}`);
  
  // TODO: Implement 2C2P-specific event processing
  // Map 2C2P event types to payment statuses
  // Update checkout_sessions and payments tables
  // Write audit_logs
  // Enqueue webhook_events
  
  console.log("2C2P event processing not fully implemented");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    const signature = req.headers.get("x-2c2p-signature");

    // Verify signature
    const isValid = await verify2C2PSignature(payload, signature);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventId = payload.transactionId || payload.invoiceNo;
    const eventType = payload.eventType || payload.respCode;

    console.log("Received 2C2P webhook event:", eventType, eventId);

    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from("provider_events")
      .select("id")
      .eq("event_id", eventId)
      .eq("provider", "twoc2p")
      .single();

    if (existingEvent) {
      console.log("Event already processed:", eventId);
      return new Response(
        JSON.stringify({ received: true, message: "Event already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store provider event
    await supabase.from("provider_events").insert({
      event_id: eventId,
      provider: "twoc2p",
      type: eventType,
      payload: payload,
    });

    // Extract tenant_id from payload
    const tenantId = payload.customData?.tenant_id || payload.userDefined1;

    if (tenantId) {
      await processPaymentEvent(supabase, payload, tenantId);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing 2C2P webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
