import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { requireStepUp } from "../_shared/mfa-guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Super admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step-up MFA check
    const stepUpResult = await requireStepUp({
      supabase,
      userId: user.id,
      action: "webhooks.replay",
      isSuperAdmin: true,
    });

    if (!stepUpResult.ok) {
      return new Response(
        JSON.stringify({ error: stepUpResult.message || 'MFA verification required', code: stepUpResult.code }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { webhookId } = await req.json();

    if (!webhookId) {
      return new Response(
        JSON.stringify({ error: "webhookId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get webhook from DLQ
    const { data: webhook, error: webhookError } = await supabase
      .from("webhook_dlq")
      .select("*")
      .eq("id", webhookId)
      .single();

    if (webhookError || !webhook) {
      return new Response(
        JSON.stringify({ error: "Webhook not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update retry count and status
    const { error: updateError } = await supabase
      .from("webhook_dlq")
      .update({
        retry_count: (webhook.retry_count || 0) + 1,
        last_attempt_at: new Date().toISOString(),
        status: "pending",
      })
      .eq("id", webhookId);

    if (updateError) {
      console.error("Error updating webhook:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update webhook" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "webhooks.replay",
      target: webhookId,
      before: { status: webhook.status, retry_count: webhook.retry_count },
      after: { status: "pending", retry_count: (webhook.retry_count || 0) + 1 },
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    });

    console.log(`Webhook ${webhookId} marked for replay by ${user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook marked for replay",
        webhook: {
          id: webhook.id,
          retry_count: (webhook.retry_count || 0) + 1,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in webhooks-replay:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
