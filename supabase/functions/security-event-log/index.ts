import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

interface SecurityEventData {
  tenantId?: string;
  userId?: string;
  eventType: 'failed_login' | 'rate_limit_violation' | 'suspicious_api_usage' | 'mfa_failure' | 'csrf_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  eventData?: Record<string, any>;
  endpoint?: string;
  requestId?: string;
  blocked?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventData: SecurityEventData = await req.json();

    // Validate required fields
    if (!eventData.eventType || !eventData.severity) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: eventType, severity' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get IP address and user agent
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Insert security event
    const { data: event, error: insertError } = await supabase
      .from('security_events')
      .insert({
        tenant_id: eventData.tenantId || null,
        user_id: eventData.userId || user.id,
        event_type: eventData.eventType,
        severity: eventData.severity,
        event_data: eventData.eventData || {},
        ip_address: ipAddress,
        user_agent: userAgent,
        endpoint: eventData.endpoint,
        request_id: eventData.requestId,
        blocked: eventData.blocked || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting security event:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to log security event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Security Event Logged]', {
      eventId: event.id,
      type: event.event_type,
      severity: event.severity,
      ip: ipAddress,
    });

    return new Response(
      JSON.stringify({ success: true, event }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Security event logging error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});