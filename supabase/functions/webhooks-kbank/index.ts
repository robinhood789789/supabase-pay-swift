import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

async function verifyKBankSignature(
  payload: any,
  signature: string | null
): Promise<boolean> {
  // TODO: Implement KBank signature verification
  // Use KBank's webhook signature validation method
  console.log("KBank signature verification not yet implemented");
  return true; // Stub: accept all for now
}

async function processPaymentEvent(
  supabase: any,
  event: any,
  tenantId: string
) {
  console.log(`Processing KBank event for tenant ${tenantId}`);
  
  // TODO: Implement KBank-specific event processing
  // Map KBank event types to payment statuses
  // Update checkout_sessions and payments tables
  // Write audit_logs
  // Enqueue webhook_events
  
  console.log("KBank event processing not fully implemented");
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
    const signature = req.headers.get("x-kbank-signature");

    // Verify signature
    const isValid = await verifyKBankSignature(payload, signature);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventId = payload.transactionId || payload.referenceNo;
    const eventType = payload.status || payload.eventType;

    console.log("Received KBank webhook event:", eventType, eventId);

    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from("provider_events")
      .select("id")
      .eq("event_id", eventId)
      .eq("provider", "kbank")
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
      provider: "kbank",
      type: eventType,
      payload: payload,
    });

    // Extract tenant_id from payload
    const tenantId = payload.metadata?.tenant_id || payload.merchantData;

    if (tenantId) {
      await processPaymentEvent(supabase, payload, tenantId);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing KBank webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
