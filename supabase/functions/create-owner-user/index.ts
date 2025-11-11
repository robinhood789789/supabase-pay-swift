import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateString, sanitizeErrorMessage } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the request is from an authenticated super admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is super admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_super_admin) {
      throw new Error('Only super admins can create owner users');
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 5 owner creations per hour per super admin
    const rateLimitResult = checkRateLimit(user.id, 5, 3600000);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many owner creation requests. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { 
      owner_user_id, 
      owner_name, 
      owner_type,
      tenant_name,
      business_type,
      force_2fa,
      payment_deposit_percentage,
      payment_withdrawal_percentage,
      features 
    } = await req.json();

    // Input validation
    const validationErrors = [];
    
    const ownerUserIdError = validateString('owner_user_id', owner_user_id, { required: true, maxLength: 255 });
    if (ownerUserIdError) validationErrors.push(ownerUserIdError);
    
    const ownerNameError = validateString('owner_name', owner_name, { required: true, maxLength: 255 });
    if (ownerNameError) validationErrors.push(ownerNameError);
    
    const ownerTypeError = validateString('owner_type', owner_type, { required: true, maxLength: 50 });
    if (ownerTypeError) validationErrors.push(ownerTypeError);
    
    const tenantNameError = validateString('tenant_name', tenant_name, { required: true, maxLength: 255 });
    if (tenantNameError) validationErrors.push(tenantNameError);

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: validationErrors.map(e => e.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate temporary password
    const temporaryPassword = `${owner_type}${Math.random().toString(36).slice(-8)}${Date.now().toString(36).slice(-4)}`;

    console.log('Creating merchant for owner:', { owner_user_id, owner_name, owner_type, tenant_name });

    // Check if owner user exists
    const { data: ownerUser } = await supabaseClient.auth.admin.getUserById(owner_user_id);
    
    if (!ownerUser || !ownerUser.user) {
      throw new Error('Owner user not found');
    }

    // Update owner profile to require password change
    await supabaseClient
      .from('profiles')
      .update({ requires_password_change: true })
      .eq('id', owner_user_id);

    // Create new tenant with additional info
    const { data: newTenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .insert({
        name: tenant_name,
        status: 'active',
        business_type: business_type,
        kyc_level: 0,
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      throw new Error(`Failed to create tenant: ${tenantError.message}`);
    }

    console.log('Tenant created successfully:', newTenant.id);

    // Create tenant settings with revenue calculation
    await supabaseClient
      .from('tenant_settings')
      .insert({
        tenant_id: newTenant.id,
        provider: 'stripe', // Default provider
        features: features || {},
        enforce_2fa_roles: force_2fa ? ['owner'] : [],
        payment_deposit_percentage: payment_deposit_percentage || 0,
        payment_withdrawal_percentage: payment_withdrawal_percentage || 0,
      });

    // Get or create owner role for this tenant
    const { data: ownerRole, error: roleError } = await supabaseClient
      .from('roles')
      .select('id')
      .eq('tenant_id', newTenant.id)
      .eq('name', 'owner')
      .single();

    let ownerRoleId = ownerRole?.id;

    if (roleError || !ownerRoleId) {
      // Create owner role
      const { data: newRole, error: createRoleError } = await supabaseClient
        .from('roles')
        .insert({
          tenant_id: newTenant.id,
          name: 'owner',
          description: 'Tenant owner with full access',
          is_system: true,
        })
        .select()
        .single();

      if (createRoleError) {
        console.error('Error creating owner role:', createRoleError);
        // Cleanup
        await supabaseClient.from('tenants').delete().eq('id', newTenant.id);
        throw new Error(`Failed to create owner role: ${createRoleError.message}`);
      }

      ownerRoleId = newRole.id;

      // Assign all permissions to owner role
      const { data: permissions } = await supabaseClient
        .from('permissions')
        .select('id');

      if (permissions && permissions.length > 0) {
        const rolePermissions = permissions.map(p => ({
          role_id: ownerRoleId,
          permission_id: p.id,
        }));

        await supabaseClient
          .from('role_permissions')
          .insert(rolePermissions);
      }
    }

    console.log('Tenant setup completed successfully');

    // Generate API Key automatically
    const generateApiKey = () => {
      const prefix = 'pk_live';
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return `${prefix}_${secret}`;
    };

    const hashSecret = async (secret: string) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(secret);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    const apiKey = generateApiKey();
    const hashedSecret = await hashSecret(apiKey);

    // Store API key in database
    const { error: apiKeyError } = await supabaseClient
      .from('api_keys')
      .insert({
        tenant_id: newTenant.id,
        name: `Auto-generated for ${owner_name}`,
        prefix: apiKey.split('_')[0] + '_' + apiKey.split('_')[1],
        hashed_secret: hashedSecret,
        key_type: 'external',
        rate_limit_tier: 'standard',
        scope: { endpoints: ['*'] },
        allowed_operations: ['read', 'write'],
        status: 'active',
        notes: `Auto-generated API key for ${owner_type} - ${owner_name}`,
      });

    if (apiKeyError) {
      console.error('Error creating API key:', apiKeyError);
      // Don't fail the entire operation
    } else {
      console.log('API key created successfully');
    }

    // Generate temporary code
    const { data: tempCodeData, error: tempCodeError } = await supabaseClient.functions.invoke(
      'temporary-code-generate',
      {
        body: {
          user_id: owner_user_id,
          tenant_id: newTenant.id,
          purpose: 'onboard_invite',
          issued_from_context: 'shareholder_create_owner',
          expires_in_hours: 72,
        },
      }
    );

    if (tempCodeError) {
      console.error('Failed to generate temporary code:', tempCodeError);
    }

    const invitationCode = tempCodeData?.code || null;

    return new Response(
      JSON.stringify({
        success: true,
        owner_user_id,
        owner_name,
        owner_type,
        tenant: {
          id: newTenant.id,
          name: newTenant.name,
        },
        invitation_code: invitationCode,
        temporary_password: temporaryPassword,
        api_key: apiKey,
        force_2fa,
        payment_deposit_percentage: payment_deposit_percentage || 0,
        payment_withdrawal_percentage: payment_withdrawal_percentage || 0,
        code_expires_at: tempCodeData?.expires_at,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in create-owner-user function:', error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorMessage(error as Error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
