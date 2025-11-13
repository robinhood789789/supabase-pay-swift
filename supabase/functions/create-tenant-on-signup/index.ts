import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant, x-csrf-token, cookie',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Input validation schema
interface CreateTenantInput {
  user_id: string;
  email: string;
  business_name: string;
  referral_code?: string;
}

const validateInput = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.user_id || typeof data.user_id !== 'string' || data.user_id.trim().length === 0) {
    errors.push('user_id is required and must be a non-empty string');
  }

  if (!data.email || typeof data.email !== 'string' || data.email.trim().length === 0) {
    errors.push('email is required and must be a non-empty string');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('email must be a valid email address');
  }

  if (!data.business_name || typeof data.business_name !== 'string' || data.business_name.trim().length === 0) {
    errors.push('business_name is required and must be a non-empty string');
  } else if (data.business_name.length > 100) {
    errors.push('business_name must be less than 100 characters');
  }

  return { valid: errors.length === 0, errors };
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate input
    const input: CreateTenantInput = await req.json();
    console.log('Create tenant request for user:', input.user_id);

    const validation = validateInput(input);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, email, business_name, referral_code } = input;

    // Check if user already has a tenant
    const { data: existingMembership, error: checkError } = await supabase
      .from('memberships')
      .select('tenant_id, tenants(name)')
      .eq('user_id', user_id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing membership:', checkError);
      throw checkError;
    }

    if (existingMembership) {
      console.log('User already has a tenant:', existingMembership.tenant_id);
      return new Response(
        JSON.stringify({ 
          error: 'User already has a tenant',
          tenant_id: existingMembership.tenant_id,
          tenant_name: (existingMembership.tenants as any)?.name
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the tenant
    console.log('Creating tenant:', business_name);
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: business_name.trim(),
        status: 'active',
        referred_by_code: referral_code || null
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      throw tenantError;
    }

    console.log('Tenant created:', tenant.id);

    // Create owner role for this tenant
    const { data: ownerRole, error: roleError } = await supabase
      .from('roles')
      .insert({
        tenant_id: tenant.id,
        name: 'owner',
        description: 'Tenant owner with full access',
        is_system: true
      })
      .select()
      .single();

    if (roleError) {
      console.error('Error creating owner role:', roleError);
      // Rollback: delete the tenant
      await supabase.from('tenants').delete().eq('id', tenant.id);
      throw roleError;
    }

    console.log('Owner role created:', ownerRole.id);

    // Create membership linking user to tenant with owner role
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: user_id,
        tenant_id: tenant.id,
        role_id: ownerRole.id
      })
      .select()
      .single();

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      // Rollback: delete role and tenant
      await supabase.from('roles').delete().eq('id', ownerRole.id);
      await supabase.from('tenants').delete().eq('id', tenant.id);
      throw membershipError;
    }

    console.log('Membership created:', membership.id);

    // Log to audit_logs
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenant.id,
        actor_user_id: user_id,
        action: 'tenant.created',
        target: `tenant:${tenant.id}`,
        after: {
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          user_id: user_id,
          email: email,
          role: 'owner'
        }
      });

    if (auditError) {
      console.error('Error logging to audit_logs:', auditError);
      // Don't fail the request if audit logging fails
    }

    console.log('Tenant creation successful');

    return new Response(
      JSON.stringify({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: tenant.status,
          created_at: tenant.created_at
        },
        role: {
          id: ownerRole.id,
          name: ownerRole.name
        },
        membership: {
          id: membership.id
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to create tenant', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
