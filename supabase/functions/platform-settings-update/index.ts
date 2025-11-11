import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { requireStepUp } from "../_shared/mfa-guards.ts";
import { requireCSRF } from "../_shared/csrf-validation.ts";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

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

    // CSRF protection
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Step-up MFA check
    const stepUpResult = await requireStepUp({
      supabase,
      userId: user.id,
      action: "platform.settings.update",
      isSuperAdmin: true,
    });

    if (!stepUpResult.ok) {
      return new Response(
        JSON.stringify({ error: stepUpResult.message || 'MFA verification required', code: stepUpResult.code }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { settings } = await req.json();

    if (!settings || typeof settings !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid settings object" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current settings for audit
    const { data: currentSettings } = await supabase
      .from("platform_settings")
      .select("*");

    const currentMap: Record<string, any> = {};
    currentSettings?.forEach((s) => {
      currentMap[s.setting_key] = s.setting_value;
    });

    // Update each setting
    const updates = [];
    for (const [key, value] of Object.entries(settings)) {
      const { error: updateError } = await supabase
        .from("platform_settings")
        .update({
          setting_value: value,
          updated_by: user.id,
        })
        .eq("setting_key", key);

      if (updateError) {
        console.error(`Error updating ${key}:`, updateError);
        updates.push({ key, success: false, error: updateError.message });
      } else {
        updates.push({ key, success: true });
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "platform.settings.update",
      target: "platform_settings",
      before: currentMap,
      after: settings,
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    });

    console.log(`Platform settings updated by ${user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updates,
        message: "Settings updated successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in platform-settings-update:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
