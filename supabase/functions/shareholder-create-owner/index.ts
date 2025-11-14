import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Authenticate shareholder
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    // Verify user is an active shareholder
    const { data: shareholder, error: shareholderError } = await supabaseClient
      .from('shareholders')
      .select('id, referral_code')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (shareholderError || !shareholder) {
      throw new Error('Not an active shareholder');
    }

    // Parse request body
    const { business_name, email, public_id } = await req.json();

    if (!business_name) {
      throw new Error('Missing required field: business_name');
    }

    if (!public_id) {
      throw new Error('Missing required field: public_id');
    }

    // Validate public_id format (PREFIX-NNNNNN)
    const publicIdRegex = /^[A-Z0-9]{2,6}-\d{6}$/;
    if (!publicIdRegex.test(public_id)) {
      throw new Error('Invalid public_id format. Must be PREFIX-NNNNNN (e.g., OWN-123456)');
    }

    // Check if public_id already exists
    const { data: existingProfile, error: checkError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('public_id', public_id)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Failed to check public_id uniqueness: ${checkError.message}`);
    }

    if (existingProfile) {
      throw new Error(`Public ID "${public_id}" already exists. Please choose a different one.`);
    }

    const generated_email = email || `${public_id.replace('-', '')}@owner.local`;

    // Generate temporary password (12 characters)
    const tempPassword = Array.from({ length: 12 }, () => 
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 56)]
    ).join('');

    // Create auth user
    const { data: createdUser, error: createUserError } = await supabaseClient.auth.admin.createUser({
      email: generated_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: business_name }
    });

    if (createUserError || !createdUser?.user?.id) {
      throw new Error(`Failed to create user: ${createUserError?.message || 'No user ID returned'}`);
    }

    const ownerUserId = createdUser.user.id;

    // Set security flags and public_id
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        requires_password_change: true,
        totp_enabled: false,
        public_id: public_id,
      })
      .eq('id', ownerUserId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw new Error(`Failed to set public_id: ${profileError.message}`);
    }

    // Generate public_id for tenant
    const { data: tenantPublicId, error: publicIdError } = await supabaseClient
      .rpc('generate_public_id', { prefix_code: 'TNT' });
    
    if (publicIdError || !tenantPublicId) {
      throw new Error(`Failed to generate tenant public_id: ${publicIdError?.message || 'No ID returned'}`);
    }

    // Create tenant with referral tracking
    const tenantId = crypto.randomUUID();
    const { data: createdTenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .insert({
        id: tenantId,
        name: business_name,
        public_id: tenantPublicId,
        user_id: public_id,
        status: 'trial',
        referred_by_code: shareholder.referral_code,
        referred_by_shareholder_id: shareholder.id
      })
      .select()
      .single();

    if (tenantError || !createdTenant) {
      console.error('Tenant creation error:', tenantError);
      throw new Error(`Failed to create tenant: ${tenantError?.message || 'No tenant data returned'}`);
    }
    const finalTenantId = (createdTenant as any).id as string;
    console.log('Tenant created successfully:', finalTenantId);

    // Find existing owner role (roles are global)
    const { data: ownerRole, error: ownerRoleError } = await supabaseClient
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .maybeSingle();

    if (ownerRoleError || !ownerRole?.id) {
      console.error('Owner role lookup error:', ownerRoleError);
      throw new Error(`Owner role not configured: ${ownerRoleError?.message || 'role not found'}`);
    }

    // Create membership
    const { data: createdMembership, error: membershipError } = await supabaseClient
      .from('memberships')
      .insert({
        user_id: ownerUserId,
        tenant_id: finalTenantId,
        role_id: ownerRole.id,
      })
      .select()
      .maybeSingle();

    if (membershipError || !createdMembership) {
      console.error('Membership creation error:', membershipError);
      throw new Error(`Failed to create membership: ${membershipError?.message || 'No membership data returned'}`);
    }

    // Link shareholder to tenant manually to avoid trigger ordering issues
    const { data: linkData, error: linkError } = await supabaseClient
      .from('shareholder_clients')
      .insert({
        shareholder_id: shareholder.id,
        tenant_id: finalTenantId,
        commission_rate: 5.0,
        status: 'active',
        referral_source: 'shareholder_portal',
      })
      .select()
      .maybeSingle();
      
    if (linkError || !linkData) {
      console.error('Shareholder link error:', linkError);
      throw new Error(`Failed to link shareholder: ${linkError?.message || 'No link data returned'}`);
    }
    
    console.log('Shareholder linked successfully to tenant:', finalTenantId);

    // Update tenant with referral info after link is created
    const { error: tenantReferralError } = await supabaseClient
      .from('tenants')
      .update({
        referred_by_code: shareholder.referral_code,
        referred_by_shareholder_id: shareholder.id,
        referral_accepted_at: new Date().toISOString(),
      })
      .eq('id', finalTenantId);
    if (tenantReferralError) {
      console.warn('Failed to update tenant referral info:', tenantReferralError);
    }

    // Create tenant settings
    await supabaseClient
      .from('tenant_settings')
      .insert({
        tenant_id: tenantId,
        provider: 'stripe',
      });

    // Create tenant wallet
    await supabaseClient
      .from('tenant_wallets')
      .insert({
        tenant_id: tenantId,
        balance: 0,
      });

    // Audit log
    await supabaseClient
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        actor_user_id: user.id,
        action: 'owner.create',
        target: `user:${ownerUserId}`,
        after: {
          business_name,
          email,
          created_by_shareholder: shareholder.id,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          owner_id: ownerUserId,
          tenant_id: tenantId,
          public_id: public_id,
          business_name: business_name,
          email: generated_email,
          temporary_password: tempPassword,
          message: 'Owner user created successfully. Please provide the temporary password securely.',
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error creating owner:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to create owner user'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
