import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

interface AlertUpdateData {
  alertId: string;
  action: 'acknowledge' | 'resolve' | 'mark_false_positive';
  notes?: string;
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

    // Check if user is admin or owner
    const { data: membership } = await supabase
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .single();

    const roleName = (membership?.roles as any)?.name;
    if (!roleName || !['owner', 'admin'].includes(roleName)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateData: AlertUpdateData = await req.json();

    if (!updateData.alertId || !updateData.action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: alertId, action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update based on action
    let updateFields: any = {
      updated_at: new Date().toISOString(),
    };

    switch (updateData.action) {
      case 'acknowledge':
        updateFields = {
          ...updateFields,
          status: 'acknowledged',
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        };
        break;
      case 'resolve':
        updateFields = {
          ...updateFields,
          status: 'resolved',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: updateData.notes || null,
        };
        break;
      case 'mark_false_positive':
        updateFields = {
          ...updateFields,
          status: 'false_positive',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: updateData.notes || 'Marked as false positive',
        };
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Update the alert
    const { data: alert, error: updateError } = await supabase
      .from('security_alerts')
      .update(updateFields)
      .eq('id', updateData.alertId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating alert:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update alert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Security Alert Updated]', {
      alertId: alert.id,
      action: updateData.action,
      userId: user.id,
    });

    return new Response(
      JSON.stringify({ success: true, alert }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Alert management error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});