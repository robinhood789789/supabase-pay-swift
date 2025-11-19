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
      .select('id')
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


    // Get tenants linked to this shareholder (2-step to avoid PostgREST relation issues)
    let baseQuery = supabaseClient
      .from('shareholder_clients')
      .select('tenant_id, status, referred_at, commission_rate')
      .eq('shareholder_id', shareholder.id);

    if (statusFilter !== 'All') {
      baseQuery = baseQuery.eq('status', statusFilter.toLowerCase());
    }

    const { data: clientLinks, error: clientLinksError } = await baseQuery;
    if (clientLinksError) throw clientLinksError;

    const tenantIds = (clientLinks || []).map((l: any) => l.tenant_id).filter(Boolean);

    let tenantsById: Record<string, any> = {};
    if (tenantIds.length > 0) {
      const { data: tenants, error: tenantsError } = await supabaseClient
        .from('tenants')
        .select('id, name, user_id, created_at, status')
        .in('id', tenantIds);
      if (tenantsError) throw tenantsError;
      tenantsById = (tenants || []).reduce((acc: Record<string, any>, t: any) => {
        acc[t.id] = t;
        return acc;
      }, {});
    }

    // Get share_ids and full_names for all tenants user_ids
    let shareIdsMap: Record<string, string> = {};
    let fullNamesMap: Record<string, string> = {};
    const userIds = Object.values(tenantsById).map((t: any) => t.user_id).filter(Boolean);
    
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id, share_id, full_name')
        .in('id', userIds);
      
      if (!profilesError && profiles) {
        profiles.forEach((p: any) => {
          if (p.share_id) {
            shareIdsMap[p.id] = p.share_id;
          }
          if (p.full_name) {
            fullNamesMap[p.id] = p.full_name;
          }
        });
        
        // Map tenant_id -> share_id and full_name via user_id
        Object.entries(tenantsById).forEach(([tenantId, tenant]: [string, any]) => {
          if (tenant.user_id) {
            if (shareIdsMap[tenant.user_id]) {
              tenantsById[tenantId].shareId = shareIdsMap[tenant.user_id];
            }
            if (fullNamesMap[tenant.user_id]) {
              tenantsById[tenantId].fullName = fullNamesMap[tenant.user_id];
            }
          }
        });
      }
    }

    const owners = (clientLinks || []).map((link: any) => {
      const tenant = tenantsById[link.tenant_id] || {};
      // Get share_id and full_name from tenant object
      const shareId = tenant.shareId || '-';
      const fullName = tenant.fullName || tenant.name || 'Unknown';
      
      return {
        ownerId: tenant.id || link.tenant_id,
        businessName: fullName,
        userId: tenant.user_id || '',
        shareId: shareId,
        createdAt: link.referred_at || tenant.created_at || null,
        status: link.status === 'active' ? 'Active' : link.status === 'trial' ? 'Trial' : (link.status || 'Churned'),
        mrr: link.status === 'active' ? Math.round(Math.random() * 5000 + 1000) : 0, // TODO: Replace with real MRR when available
        commission_rate: link.commission_rate
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
