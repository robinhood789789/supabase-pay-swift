import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { requireMFA } from '../_shared/mfa-guards.ts';
import { validateFields, validateString, ValidationException, sanitizeErrorMessage } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    // Create Supabase clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check MFA
    await requireMFA(user.id);

    // Parse request
    const { alert_id, action, notes } = await req.json();

    // Validate inputs
    validateFields([
      () => validateString('alert_id', alert_id, { required: true }),
      () => validateString('action', action, { required: true, maxLength: 50 }),
    ]);

    if (!['acknowledge', 'resolve', 'false_positive'].includes(action)) {
      throw new Error('Invalid action');
    }

    // Get alert
    const { data: alert, error: alertError } = await supabaseAdmin
      .from('security_alerts')
      .select('*')
      .eq('id', alert_id)
      .single();

    if (alertError || !alert) {
      return new Response(
        JSON.stringify({ error: 'Alert not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check permissions
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    const isSuperAdmin = profile?.is_super_admin || false;

    // If not super admin, check if user has admin role in alert's tenant
    if (!isSuperAdmin && alert.tenant_id) {
      const { data: membership } = await supabaseClient
        .from('memberships')
        .select('role_id, roles!inner(name)')
        .eq('user_id', user.id)
        .eq('tenant_id', alert.tenant_id)
        .single();

      const hasAdminRole = Array.isArray(membership?.roles) 
        ? membership.roles.some((r: any) => r.name === 'owner' || r.name === 'admin')
        : (membership?.roles as any)?.name === 'owner' || (membership?.roles as any)?.name === 'admin';
      
      if (!hasAdminRole) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update alert based on action
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'acknowledge') {
      updateData.status = 'acknowledged';
      updateData.acknowledged_by = user.id;
      updateData.acknowledged_at = new Date().toISOString();
    } else if (action === 'resolve') {
      updateData.status = 'resolved';
      updateData.resolved_by = user.id;
      updateData.resolved_at = new Date().toISOString();
    } else if (action === 'false_positive') {
      updateData.status = 'false_positive';
      updateData.resolved_by = user.id;
      updateData.resolved_at = new Date().toISOString();
    }

    if (notes) {
      updateData.resolution_notes = notes;
    }

    const { error: updateError } = await supabaseAdmin
      .from('security_alerts')
      .update(updateData)
      .eq('id', alert_id);

    if (updateError) {
      console.error('Error updating alert:', updateError);
      throw new Error(`Failed to update alert: ${updateError.message}`);
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: user.id,
      action: `security_alert_${action}`,
      target: 'security_alert',
      tenant_id: alert.tenant_id,
      before: { status: alert.status },
      after: { status: updateData.status, notes },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Alert updated successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in security-alerts-manage:', error);
    
    if (error instanceof ValidationException) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errorMessage = error instanceof Error ? sanitizeErrorMessage(error) : 'An error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});