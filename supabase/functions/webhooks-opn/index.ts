import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { WebhookEvent } from "../_shared/types.ts";

async function verifyOmiseSignature(
  payload: string,
  signature: string | null
): Promise<boolean> {
  // TODO: Implement OPN (Omise) signature verification
  // https://docs.opn.ooo/security-best-practices
  console.log("OPN signature verification not yet implemented");
  return true; // Stub: accept all for now
}

async function processPaymentEvent(
  supabase: any,
  event: any,
  tenantId: string
) {
  console.log(`Processing OPN event: ${event.key} for tenant ${tenantId}`);
  
  // TODO: Implement OPN-specific event processing
  // Map OPN event types to payment statuses
  // Update checkout_sessions and payments tables
  // Write audit_logs
  // Enqueue webhook_events
  
  console.log("OPN event processing not fully implemented");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const signature = req.headers.get("x-omise-signature");
    const payload = await req.text();

    // Verify signature
    const isValid = await verifyOmiseSignature(payload, signature);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(payload);
    console.log("Received OPN webhook event:", event.key, event.id);

    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from("provider_events")
      .select("id")
      .eq("event_id", event.id)
      .eq("provider", "opn")
      .single();

    if (existingEvent) {
      console.log("Event already processed:", event.id);
      return new Response(
        JSON.stringify({ received: true, message: "Event already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store provider event
    await supabase.from("provider_events").insert({
      event_id: event.id,
      provider: "opn",
      type: event.key,
      payload: event,
    });

    // Extract tenant_id from event data
    const tenantId = event.data?.metadata?.tenant_id;

    if (tenantId) {
      await processPaymentEvent(supabase, event, tenantId);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing OPN webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
