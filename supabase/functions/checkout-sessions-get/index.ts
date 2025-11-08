import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenant",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant ID from header
    const tenantId = req.headers.get("x-tenant");
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "X-Tenant header is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract session ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const sessionId = pathParts[pathParts.length - 1];

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Session ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching session ${sessionId} for tenant ${tenantId}`);

    // Fetch session from database
    const { data: session, error: dbError } = await supabase
      .from("checkout_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)
      .single();

    if (dbError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate remaining seconds if pending and near expiry
    let remainingSeconds: number | undefined;
    if (session.status === "pending" && session.expires_at) {
      const expiryTime = new Date(session.expires_at).getTime();
      const now = Date.now();
      const remaining = Math.floor((expiryTime - now) / 1000);
      
      if (remaining > 0 && remaining < 3600) { // Show if less than 1 hour remaining
        remainingSeconds = remaining;
      }
    }

    const response = {
      id: session.id,
      status: session.status,
      amount: session.amount,
      currency: session.currency,
      reference: session.reference,
      redirect_url: session.redirect_url,
      qr_image_url: session.qr_image_url,
      expires_at: session.expires_at,
      created_at: session.created_at,
      ...(remainingSeconds !== undefined && { remaining_seconds: remainingSeconds }),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in checkout-sessions-get:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
