import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const tenantId = req.headers.get('x-tenant');
    
    // If no tenant specified, evaluate all tenants (for cron job)
    const tenantFilter = tenantId ? { tenant_id: tenantId } : {};

    // Get all active alert rules
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('resolved', false)
      .match(tenantFilter);

    if (alertsError) throw alertsError;

    if (!alerts || alerts.length === 0) {
      console.log('[Alerts] No active alert rules found');
      return new Response(
        JSON.stringify({ evaluated: 0, triggered: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let triggeredCount = 0;

    for (const alert of alerts) {
      const alertType = alert.alert_type;
      const metadata = alert.metadata || {};
      
      let shouldTrigger = false;
      let eventData: any = {};

      // Evaluate based on alert type
      switch (alertType) {
        case 'excessive_refunds':
          shouldTrigger = await checkExcessiveRefunds(supabase, alert, metadata);
          eventData = { type: 'excessive_refunds', threshold: metadata.threshold };
          break;

        case 'excessive_exports':
          shouldTrigger = await checkExcessiveExports(supabase, alert, metadata);
          eventData = { type: 'excessive_exports', threshold: metadata.threshold };
          break;

        case 'api_key_outside_hours':
          shouldTrigger = await checkApiKeyOutsideHours(supabase, alert, metadata);
          eventData = { type: 'api_key_outside_hours' };
          break;

        case 'new_login_location':
          shouldTrigger = await checkNewLoginLocation(supabase, alert, metadata);
          eventData = { type: 'new_login_location' };
          break;

        case 'failed_mfa_attempts':
          shouldTrigger = await checkFailedMFAAttempts(supabase, alert, metadata);
          eventData = { type: 'failed_mfa_attempts', threshold: metadata.threshold };
          break;

        default:
          console.warn(`[Alerts] Unknown alert type: ${alertType}`);
      }

      if (shouldTrigger) {
        // Check cooldown period to avoid duplicate alerts
        const cooldownMinutes = metadata.cooldown_minutes || 60;
        const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

        const { data: recentEvents } = await supabase
          .from('alert_events')
          .select('id')
          .eq('alert_id', alert.id)
          .gte('created_at', cooldownTime.toISOString());

        if (!recentEvents || recentEvents.length === 0) {
          // Create alert event
          await supabase
            .from('alert_events')
            .insert({
              alert_id: alert.id,
              event_type: alertType,
              event_data: eventData,
            });

          triggeredCount++;
          console.log(`[Alerts] Triggered: ${alert.title} (${alertType})`);
        } else {
          console.log(`[Alerts] Skipped (cooldown): ${alert.title}`);
        }
      }
    }

    console.log(`[Alerts] Evaluated ${alerts.length} rules, triggered ${triggeredCount}`);

    return new Response(
      JSON.stringify({ evaluated: alerts.length, triggered: triggeredCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Alerts] Evaluation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to evaluate alerts' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkExcessiveRefunds(supabase: any, alert: any, metadata: any): Promise<boolean> {
  const threshold = metadata.threshold || 10;
  const windowHours = metadata.window_hours || 1;
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_user_id')
    .eq('tenant_id', alert.tenant_id)
    .eq('action', 'refund.created')
    .gte('created_at', windowStart.toISOString());

  if (error || !data) return false;

  // Count refunds by single admin
  const refundsByUser: Record<string, number> = {};
  for (const log of data) {
    refundsByUser[log.actor_user_id] = (refundsByUser[log.actor_user_id] || 0) + 1;
  }

  return Object.values(refundsByUser).some(count => count > threshold);
}

async function checkExcessiveExports(supabase: any, alert: any, metadata: any): Promise<boolean> {
  const threshold = metadata.threshold || 5;
  const windowHours = metadata.window_hours || 24;
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('tenant_id', alert.tenant_id)
    .eq('action', 'export.created')
    .gte('created_at', windowStart.toISOString());

  if (error || !data) return false;

  return data.length > threshold;
}

async function checkApiKeyOutsideHours(supabase: any, alert: any, metadata: any): Promise<boolean> {
  const windowMinutes = metadata.window_minutes || 60;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, created_at')
    .eq('tenant_id', alert.tenant_id)
    .eq('action', 'api_key.created')
    .gte('created_at', windowStart.toISOString());

  if (error || !data || data.length === 0) return false;

  // Check if any were created outside business hours
  for (const log of data) {
    const date = new Date(log.created_at);
    const hour = date.getHours();
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    const outsideHours = hour < 9 || hour >= 17;

    if (isWeekend || outsideHours) {
      return true;
    }
  }

  return false;
}

async function checkNewLoginLocation(supabase: any, alert: any, metadata: any): Promise<boolean> {
  // This would require tracking login IPs/locations
  // For now, return false - can be implemented with more sophisticated tracking
  return false;
}

async function checkFailedMFAAttempts(supabase: any, alert: any, metadata: any): Promise<boolean> {
  const threshold = metadata.threshold || 3;
  const windowMinutes = metadata.window_minutes || 30;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_user_id')
    .eq('tenant_id', alert.tenant_id)
    .eq('action', 'mfa.challenge.failed')
    .gte('created_at', windowStart.toISOString());

  if (error || !data) return false;

  // Count failures by user
  const failuresByUser: Record<string, number> = {};
  for (const log of data) {
    if (log.actor_user_id) {
      failuresByUser[log.actor_user_id] = (failuresByUser[log.actor_user_id] || 0) + 1;
    }
  }

  return Object.values(failuresByUser).some(count => count >= threshold);
}
