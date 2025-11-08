import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant ID from header
    const tenantId = req.headers.get('X-Tenant');
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'X-Tenant header required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check permission: payment_links:create
    const { data: membership } = await supabase
      .from('memberships')
      .select('role_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: permissions } = await supabase
      .from('role_permissions')
      .select('permissions(name)')
      .eq('role_id', membership.role_id);

    const hasPermission = permissions?.some(
      (p: any) => p.permissions.name === 'payment_links:create'
    );

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Missing permission: payment_links:create' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const { amount, currency, reference, expiresAt, usageLimit } = body;

    if (!amount || !currency) {
      return new Response(JSON.stringify({ error: 'amount and currency are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique slug (8 characters)
    const slug = crypto.randomUUID().split('-')[0];

    // Insert payment link
    const { data: link, error: insertError } = await supabase
      .from('payment_links')
      .insert({
        tenant_id: tenantId,
        slug,
        amount,
        currency,
        reference: reference || null,
        expires_at: expiresAt || null,
        usage_limit: usageLimit || null,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating payment link:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create payment link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'payment_link.created',
      target: `payment_link:${link.id}`,
      after: link,
    });

    console.log(`Payment link created: ${slug}`);

    return new Response(JSON.stringify(link), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
