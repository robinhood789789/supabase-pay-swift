import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requestingUser) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('🔐 Requesting user:', requestingUser.id);

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      throw new Error('Missing tenant_id');
    }

    console.log('🗑️ Delete owner request for tenant:', tenant_id);

    // Get the shareholder record by user_id
    const { data: shareholderRecord, error: shareholderError } = await supabase
      .from('shareholders')
      .select('id')
      .eq('user_id', requestingUser.id)
      .single();

    if (shareholderError || !shareholderRecord) {
      console.error('Shareholder lookup error:', shareholderError);
      throw new Error('Not a valid shareholder');
    }

    const shareholderId = shareholderRecord.id;
    console.log('👤 Shareholder ID:', shareholderId);

    // Check if this tenant is linked to this shareholder
    const { data: clientLink, error: linkError } = await supabase
      .from('shareholder_clients')
      .select('id, shareholder_id')
      .eq('tenant_id', tenant_id)
      .eq('shareholder_id', shareholderId)
      .single();

    if (linkError || !clientLink) {
      console.warn('Client link not found, checking tenants fallback...', linkError);

      // Fallback: verify via tenants.referred_by_shareholder_id
      const { data: tenantRow, error: tenantCheckError } = await supabase
        .from('tenants')
        .select('id, referred_by_shareholder_id')
        .eq('id', tenant_id)
        .eq('referred_by_shareholder_id', shareholderId)
        .single();

      if (tenantCheckError || !tenantRow) {
        console.error('Tenant fallback check failed:', tenantCheckError);
        throw new Error('You do not have permission to delete this owner. This tenant is not linked to your shareholder account.');
      }

      console.log('✅ Verified via tenants.referred_by_shareholder_id');
    }

    console.log('✅ Verified shareholder owns this tenant');

    // Get all users in this tenant
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('tenant_id', tenant_id);

    if (membershipsError) {
      console.error('Memberships error:', membershipsError);
      throw new Error('Failed to get tenant members');
    }

    const userIds = memberships?.map(m => m.user_id) || [];
    console.log('👥 Users to delete:', userIds);

    // Delete all memberships for this tenant
    const { error: deleteMembershipsError } = await supabase
      .from('memberships')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteMembershipsError) {
      console.error('Delete memberships error:', deleteMembershipsError);
      throw new Error('Failed to delete memberships');
    }

    console.log('✅ Deleted memberships');

    // Delete shareholder_clients record
    const { error: deleteClientLinkError } = await supabase
      .from('shareholder_clients')
      .delete()
      .eq('tenant_id', tenant_id)
      .eq('shareholder_id', shareholderId);

    if (deleteClientLinkError) {
      console.error('Delete client link error:', deleteClientLinkError);
      throw new Error('Failed to delete client link');
    }

    console.log('✅ Deleted shareholder client link');

    // Delete profiles for each user
    for (const userId of userIds) {
      const { error: deleteProfileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (deleteProfileError) {
        console.error(`Failed to delete profile for user ${userId}:`, deleteProfileError);
      } else {
        console.log(`✅ Deleted profile for user ${userId}`);
      }
    }

    // Delete auth users
    for (const userId of userIds) {
      try {
        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
        
        if (deleteAuthError) {
          console.error(`Failed to delete auth user ${userId}:`, deleteAuthError);
        } else {
          console.log(`✅ Deleted auth user ${userId}`);
        }
      } catch (error) {
        console.error(`Error deleting auth user ${userId}:`, error);
      }
    }

    // Log the action in audit log
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id,
        actor_user_id: requestingUser.id,
        action: 'shareholder.owner_deleted',
        target: tenant_id,
        before: { user_ids: userIds },
        after: null,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Owner and tenant deleted successfully',
        deleted_users: userIds.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
