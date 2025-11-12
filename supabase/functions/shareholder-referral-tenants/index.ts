import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    // Get public_ids for all tenants user_ids
    let publicIdsMap: Record<string, string> = {};
    const userIds = Object.values(tenantsById).map((t: any) => t.user_id).filter(Boolean);
    
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id, public_id')
        .in('id', userIds);
      
      if (!profilesError && profiles) {
        const profilesById = profiles.reduce((acc: Record<string, string>, p: any) => {
          if (p.public_id) {
            acc[p.id] = p.public_id;
          }
          return acc;
        }, {});
        
        // Map tenant_id -> public_id via user_id
        Object.entries(tenantsById).forEach(([tenantId, tenant]: [string, any]) => {
          if (tenant.user_id && profilesById[tenant.user_id]) {
            publicIdsMap[tenantId] = profilesById[tenant.user_id];
          }
        });
      }
    }

    const owners = (clientLinks || []).map((link: any) => {
      const tenant = tenantsById[link.tenant_id] || {};
      const publicId = publicIdsMap[link.tenant_id] || '';
      
      return {
        ownerId: tenant.id || link.tenant_id,
        businessName: tenant.name || 'Unknown',
        userId: tenant.user_id || '',
        publicId: publicId || '-',
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
