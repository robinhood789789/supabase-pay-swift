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

    // Get shareholder info
    const { data: shareholder, error: shareholderError } = await supabaseClient
      .from('shareholders')
      .select('id, default_commission_value')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (shareholderError || !shareholder) {
      throw new Error('Not a shareholder');
    }

    // Get filters from URL or request body
    const url = new URL(req.url);
    let statusFilter = url.searchParams.get('status') || 'All';
    try {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => null);
        if (body && typeof body.status === 'string') {
          statusFilter = body.status;
        }
      }
    } catch (_) {/* ignore body parse errors */}

    // Query tenants directly by referred_by_code = shareholder user_id
    let tenantsQuery = supabaseClient
      .from('tenants')
      .select('id, name, public_id, user_id, created_at, status, referral_accepted_at')
      .eq('referred_by_code', user.id);

    if (statusFilter !== 'All') {
      tenantsQuery = tenantsQuery.eq('status', statusFilter.toLowerCase());
    }

    const { data: tenants, error: tenantsError } = await tenantsQuery;
    if (tenantsError) throw tenantsError;

    // Get share_ids for all tenant user_ids
    let shareIdsMap: Record<string, string> = {};
    const userIds = (tenants || []).map((t: any) => t.user_id).filter(Boolean);
    
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id, share_id')
        .in('id', userIds);
      
      if (!profilesError && profiles) {
        profiles.forEach((p: any) => {
          if (p.share_id) {
            shareIdsMap[p.id] = p.share_id;
          }
        });
      }
    }

    // Get commission rates from shareholder_clients if they exist
    const tenantIds = (tenants || []).map((t: any) => t.id);
    let commissionRatesMap: Record<string, number> = {};
    
    if (tenantIds.length > 0) {
      const { data: clientLinks } = await supabaseClient
        .from('shareholder_clients')
        .select('tenant_id, commission_rate')
        .eq('shareholder_id', shareholder.id)
        .in('tenant_id', tenantIds);
      
      if (clientLinks) {
        clientLinks.forEach((link: any) => {
          commissionRatesMap[link.tenant_id] = link.commission_rate;
        });
      }
    }

    const owners = (tenants || []).map((tenant: any) => {
      const tenantPublicId = tenant.public_id || '-';
      const tenantName = tenant.name || 'Unknown';
      const shareId = tenant.user_id ? shareIdsMap[tenant.user_id] : null;
      const commissionRate = commissionRatesMap[tenant.id] || shareholder.default_commission_value || 0;
      
      // Determine status
      let displayStatus = 'Active';
      if (tenant.status === 'trial') {
        displayStatus = 'Trial';
      } else if (tenant.status !== 'active') {
        displayStatus = 'Churned';
      }
      
      return {
        ownerId: tenant.id,
        businessName: tenantName,
        publicId: tenantPublicId,
        userId: tenant.user_id || '',
        shareId: shareId || '-',
        createdAt: tenant.referral_accepted_at || tenant.created_at || null,
        status: displayStatus,
        mrr: tenant.status === 'active' ? Math.round(Math.random() * 5000 + 1000) : 0, // TODO: Replace with real MRR when available
        commission_rate: commissionRate
      };
    });
    return new Response(
      JSON.stringify({
        success: true,
        data: owners
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[shareholder-referral-tenants] Full error:', error);
    const errorMessage = error?.message || error?.msg || 'Unknown error occurred';
    const errorDetails = {
      message: errorMessage,
      code: error?.code,
      details: error?.details,
      hint: error?.hint
    };
    console.error('[shareholder-referral-tenants] Error details:', errorDetails);
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
