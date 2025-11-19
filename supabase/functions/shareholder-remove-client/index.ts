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
    console.log('[shareholder-remove-client] User authorization:', { isSuperAdmin, userId: user.id });

    if (!isSuperAdmin) {
      // Check if user is shareholder
      const { data: shareholder, error: shareholderError } = await supabaseClient
        .from('shareholders')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      console.log('[shareholder-remove-client] Shareholder check:', { 
        shareholderId: shareholder?.id, 
        error: shareholderError?.message 
      });

      if (shareholderError || !shareholder) {
        throw new Error('Not authorized: must be shareholder or super admin');
      }

      // Check if this tenant is linked to this shareholder
      const { data: clientLink, error: linkError } = await supabaseClient
        .from('shareholder_clients')
        .select('id')
        .eq('shareholder_id', shareholder.id)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      console.log('[shareholder-remove-client] Client link check:', { 
        linkExists: !!clientLink, 
        linkError: linkError?.message 
      });

      if (linkError) {
        console.error('[shareholder-remove-client] Error checking client link:', linkError);
        throw new Error('Error checking tenant link');
      }

      if (!clientLink) {
        throw new Error('Tenant not linked to this shareholder');
      }
    } else {
      console.log('[shareholder-remove-client] Super admin bypass - skipping shareholder check');
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
    console.log('[shareholder-remove-client] Starting deletion process for tenant:', tenant_id);
    
    // 1. Delete api_keys (has FK to tenants)
    const { error: deleteApiKeysError } = await supabaseClient
      .from('api_keys')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteApiKeysError) {
      console.error('[shareholder-remove-client] Error deleting api_keys:', deleteApiKeysError);
    }

    // 2. Delete alerts (has FK to tenants)
    const { error: deleteAlertsError } = await supabaseClient
      .from('alerts')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteAlertsError) {
      console.error('[shareholder-remove-client] Error deleting alerts:', deleteAlertsError);
    }

    // 3. Delete customers (has FK to tenants)
    const { error: deleteCustomersError } = await supabaseClient
      .from('customers')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteCustomersError) {
      console.error('[shareholder-remove-client] Error deleting customers:', deleteCustomersError);
    }

    // 4. Delete payment_links (has FK to tenants)
    const { error: deletePaymentLinksError } = await supabaseClient
      .from('payment_links')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deletePaymentLinksError) {
      console.error('[shareholder-remove-client] Error deleting payment_links:', deletePaymentLinksError);
    }

    // 5. Delete refunds (has FK to tenants)
    const { error: deleteRefundsError } = await supabaseClient
      .from('refunds')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteRefundsError) {
      console.error('[shareholder-remove-client] Error deleting refunds:', deleteRefundsError);
    }

    // 6. Delete disputes (has FK to tenants)
    const { error: deleteDisputesError } = await supabaseClient
      .from('disputes')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteDisputesError) {
      console.error('[shareholder-remove-client] Error deleting disputes:', deleteDisputesError);
    }

    // 7. Delete settlements (has FK to tenants)
    const { error: deleteSettlementsError } = await supabaseClient
      .from('settlements')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteSettlementsError) {
      console.error('[shareholder-remove-client] Error deleting settlements:', deleteSettlementsError);
    }

    // 8. Delete go_live_checklist (has FK to tenants)
    const { error: deleteChecklistError } = await supabaseClient
      .from('go_live_checklist')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteChecklistError) {
      console.error('[shareholder-remove-client] Error deleting go_live_checklist:', deleteChecklistError);
    }

    // 9. Delete guardrails (has FK to tenants)
    const { error: deleteGuardrailsError } = await supabaseClient
      .from('guardrails')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteGuardrailsError) {
      console.error('[shareholder-remove-client] Error deleting guardrails:', deleteGuardrailsError);
    }

    // 10. Delete kyc_documents (has FK to tenants)
    const { error: deleteKycError } = await supabaseClient
      .from('kyc_documents')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteKycError) {
      console.error('[shareholder-remove-client] Error deleting kyc_documents:', deleteKycError);
    }

    // 11. Delete deposit_transfers (has FK to tenants)
    const { error: deleteDepositsError } = await supabaseClient
      .from('deposit_transfers')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteDepositsError) {
      console.error('[shareholder-remove-client] Error deleting deposit_transfers:', deleteDepositsError);
    }

    // 12. Delete shareholder_clients
    const { error: deleteClientsError } = await supabaseClient
      .from('shareholder_clients')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteClientsError) {
      console.error('[shareholder-remove-client] Error deleting shareholder_clients:', deleteClientsError);
      throw deleteClientsError;
    }

    // 13. Delete memberships
    const { error: deleteMembershipsError } = await supabaseClient
      .from('memberships')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteMembershipsError) {
      console.error('[shareholder-remove-client] Error deleting memberships:', deleteMembershipsError);
      throw deleteMembershipsError;
    }

    // 14. Delete profiles linked to this tenant
    const { error: deleteProfilesError } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteProfilesError) {
      console.error('[shareholder-remove-client] Error deleting profiles:', deleteProfilesError);
    }

    // 15. Finally, delete tenant
    const { error: deleteTenantError } = await supabaseClient
      .from('tenants')
      .delete()
      .eq('id', tenant_id);

    if (deleteTenantError) {
      console.error('[shareholder-remove-client] Error deleting tenant:', deleteTenantError);
      throw deleteTenantError;
    }

    console.log('[shareholder-remove-client] Successfully deleted all related data for tenant:', tenant_id);

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
