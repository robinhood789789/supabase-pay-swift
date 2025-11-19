import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      throw new Error('tenant_id is required');
    }

    console.log('[shareholder-remove-client] Processing request:', { tenant_id, user_id: user.id });

    // Check if user is shareholder or super admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    const isSuperAdmin = profile?.is_super_admin === true;

    if (!isSuperAdmin) {
      // Check if user is shareholder
      const { data: shareholder, error: shareholderError } = await supabaseClient
        .from('shareholders')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (shareholderError || !shareholder) {
        throw new Error('Not authorized: must be shareholder or super admin');
      }

      // Check if this tenant is linked to this shareholder
      const { data: clientLink, error: linkError } = await supabaseClient
        .from('shareholder_clients')
        .select('id')
        .eq('shareholder_id', shareholder.id)
        .eq('tenant_id', tenant_id)
        .single();

      if (linkError || !clientLink) {
        throw new Error('Tenant not linked to this shareholder');
      }
    }

    // Check for payments (prevent deletion if has transactions)
    const { data: payments, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('id')
      .eq('tenant_id', tenant_id)
      .limit(1);

    if (paymentsError) throw paymentsError;

    if (payments && payments.length > 0) {
      throw new Error('Cannot delete: tenant has payment transactions');
    }

    // Get tenant info for logging
    const { data: tenant } = await supabaseClient
      .from('tenants')
      .select('name')
      .eq('id', tenant_id)
      .single();

    // Delete in order (respecting foreign key constraints)
    
    // 1. Delete shareholder_clients
    const { error: deleteClientsError } = await supabaseClient
      .from('shareholder_clients')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteClientsError) {
      console.error('[shareholder-remove-client] Error deleting shareholder_clients:', deleteClientsError);
      throw deleteClientsError;
    }

    // 2. Delete memberships
    const { error: deleteMembershipsError } = await supabaseClient
      .from('memberships')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteMembershipsError) {
      console.error('[shareholder-remove-client] Error deleting memberships:', deleteMembershipsError);
      throw deleteMembershipsError;
    }

    // 3. Delete profiles linked to this tenant
    const { error: deleteProfilesError } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteProfilesError) {
      console.error('[shareholder-remove-client] Error deleting profiles:', deleteProfilesError);
      // Don't throw, continue with tenant deletion
    }

    // 4. Delete tenant
    const { error: deleteTenantError } = await supabaseClient
      .from('tenants')
      .delete()
      .eq('id', tenant_id);

    if (deleteTenantError) {
      console.error('[shareholder-remove-client] Error deleting tenant:', deleteTenantError);
      throw deleteTenantError;
    }

    // Log the action
    await supabaseClient
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        action: 'tenant_deleted',
        target: `tenant:${tenant_id}`,
        before: { tenant_id, tenant_name: tenant?.name },
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent')
      });

    console.log('[shareholder-remove-client] Successfully deleted tenant:', tenant_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tenant deleted successfully',
        deleted_tenant_id: tenant_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[shareholder-remove-client] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
