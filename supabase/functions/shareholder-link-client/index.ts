import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    // Get auth user from request
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

    // Check if user is super admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      throw new Error('Only super admins can link clients to shareholders');
    }

    // Get request body
    const { shareholderId, tenantId, commissionRate } = await req.json();

    if (!shareholderId || !tenantId) {
      throw new Error('Shareholder ID and Tenant ID are required');
    }

    const rate = commissionRate || 0;
    if (rate < 0 || rate > 100) {
      throw new Error('Commission rate must be between 0 and 100');
    }

    // Verify shareholder exists
    const { data: shareholder, error: shareholderError } = await supabaseClient
      .from('shareholders')
      .select('id')
      .eq('id', shareholderId)
      .single();

    if (shareholderError || !shareholder) {
      throw new Error('Shareholder not found');
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error('Tenant not found');
    }

    // Create shareholder-client link
    const { data: link, error: linkError } = await supabaseClient
      .from('shareholder_clients')
      .insert({
        shareholder_id: shareholderId,
        tenant_id: tenantId,
        commission_rate: rate,
        status: 'active'
      })
      .select()
      .single();

    if (linkError) {
      console.error('Error creating shareholder-client link:', linkError);
      throw new Error(`Failed to link client: ${linkError.message}`);
    }

    // Update shareholder active clients count
    const { error: updateError } = await supabaseClient.rpc('increment', {
      table_name: 'shareholders',
      column_name: 'active_clients_count',
      row_id: shareholderId,
      step: 1
    });

    console.log(`Client linked to shareholder successfully: ${link.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        link: {
          id: link.id,
          shareholder_id: link.shareholder_id,
          tenant_id: link.tenant_id,
          tenant_name: tenant.name,
          commission_rate: link.commission_rate
        },
        message: 'Client linked successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in shareholder-link-client:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
