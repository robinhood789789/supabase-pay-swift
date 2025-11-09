import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { 
  validateEmail, 
  validateFullName, 
  validatePassword, 
  validatePublicId,
  validateFields,
  ValidationException,
  sanitizeErrorMessage
} from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token, cookie',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the request is from an authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('ไม่พบ Authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('ไม่ได้รับอนุญาต');
    }

    // SECURITY: CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // SECURITY: Rate limiting (10 users per hour per user)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `create-admin:${user.id}:${clientIp}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 10, 3600000, 0); // 10 per hour
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 10 user creations per hour.',
          remaining: rateLimit.remaining 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateLimit.remaining)
          } 
        }
      );
    }

    const { prefix, user_number, public_id, password, full_name, role, tenant_id, permissions } = await req.json();

    // SECURITY: Input validation
    try {
      validateFields([
        () => validatePublicId(public_id),
        () => validatePassword(password),
        () => validateFullName(full_name),
      ]);
    } catch (error) {
      if (error instanceof ValidationException) {
        return new Response(
          JSON.stringify({ 
            error: 'Validation failed', 
            details: error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    if (!prefix || !user_number || !public_id || !password || !full_name || !role || !tenant_id) {
      throw new Error('ข้อมูลไม่ครบถ้วน');
    }

    // Generate email from public_id
    const email = `${public_id.toLowerCase()}@user.local`;

    console.log('Creating admin user:', { public_id, email, role, tenant_id });

    // Verify user has permission in the tenant
    const { data: membership } = await supabaseClient
      .from('memberships')
      .select('role_id, roles(name)')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!membership) {
      throw new Error('คุณไม่มีสิทธิ์ในเทนนันต์นี้');
    }

    const userRole = (membership.roles as any)?.name;
    if (userRole !== 'owner' && userRole !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์สร้างผู้ใช้');
    }

    // Check if user already exists by email or public_id
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);
    
    // Also check if public_id is already used
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('id, email')
      .eq('public_id', public_id)
      .maybeSingle();
    
    if (existingProfile && existingUser && existingProfile.id !== existingUser.id) {
      throw new Error(`User ID ${public_id} ถูกใช้แล้วโดยผู้ใช้คนอื่น`);
    }

    let userId: string | undefined;

    if (existingUser) {
      console.log('User already exists, adding to tenant:', existingUser.id);
      userId = existingUser.id;

      // Check if user already has membership in this tenant
      const { data: existingMembership } = await supabaseClient
        .from('memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (existingMembership) {
        throw new Error('ผู้ใช้นี้มีอยู่ในเทนนันต์นี้แล้ว');
      }

      // Update user's full_name and public_id if provided
      if (full_name && (!existingUser.user_metadata?.full_name || existingUser.user_metadata.full_name === '')) {
        await supabaseClient.auth.admin.updateUserById(userId, {
          user_metadata: { full_name }
        });
      }
      
      // Update public_id if not set
      await supabaseClient
        .from('profiles')
        .update({ public_id: public_id })
        .eq('id', userId)
        .is('public_id', null);
    } else if (existingProfile) {
      // Profile exists with this public_id but no auth user - cleanup orphaned profile
      console.log('Found orphaned profile, cleaning up:', existingProfile.id);
      await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', existingProfile.id);
      console.log('Orphaned profile deleted, proceeding with new user creation');
    }
    
    // Create the new user if needed
    if (!userId) {
      console.log('Creating new user');
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      });

      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }

      if (!newUser.user) {
        throw new Error('ไม่สามารถสร้างผู้ใช้ได้');
      }

      userId = newUser.user.id;
      console.log('New user created:', userId);

      // Set requires_password_change and public_id for new users
      await supabaseClient
        .from('profiles')
        .update({ 
          requires_password_change: true,
          public_id: public_id 
        })
        .eq('id', userId);
    }

    // Get or create the role ID for the specified role in this tenant
    let roleId: string | null = null;
    const { data: roleData, error: roleError } = await supabaseClient
      .from('roles')
      .select('id')
      .eq('name', role)
      .eq('tenant_id', tenant_id)
      .eq('is_system', true)
      .maybeSingle();

    console.log('Role lookup (system only):', { role, roleData, roleError });

    if (roleData?.id) {
      roleId = roleData.id;
    } else {
      // Fallback: try without is_system in case roles were created differently
      const { data: fallbackRole, error: fallbackError } = await supabaseClient
        .from('roles')
        .select('id, is_system')
        .eq('name', role)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      console.log('Role fallback lookup (any):', { fallbackRole, fallbackError });

      if (fallbackRole?.id) {
        roleId = fallbackRole.id;
      } else {
        // Auto-create the missing system role for this tenant
        console.log(`Creating missing system role '${role}' for tenant ${tenant_id}`);
        const { data: createdRole, error: createRoleError } = await supabaseClient
          .from('roles')
          .insert({
            tenant_id: tenant_id,
            name: role,
            description: `${role} role (auto-created)`,
            is_system: true,
          })
          .select('id')
          .single();

        if (createRoleError || !createdRole) {
          if (!existingUser) {
            console.log('Cleaning up newly created user due to role creation error');
            await supabaseClient.auth.admin.deleteUser(userId);
          }
          throw new Error(`ไม่สามารถสร้างบทบาท ${role} สำหรับเทนนันต์นี้ได้`);
        }

        roleId = createdRole.id;

        // Assign permissions from the request
        console.log(`Assigning custom permissions to new ${role} role`);
        
        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
          // Use custom permissions selected by owner
          const rolePermissions = permissions.map((permissionId: string) => ({
            role_id: roleId,
            permission_id: permissionId
          }));
          
          const { error: permError } = await supabaseClient
            .from('role_permissions')
            .insert(rolePermissions);
          
          if (permError) {
            console.error('Error assigning permissions:', permError);
          }
        } else {
          // Fallback to default permissions based on role type if no custom permissions provided
          console.log(`No custom permissions provided, using default permissions for ${role}`);
          
          if (role === 'admin' || role === 'manager') {
            // Admin/Manager: all permissions except sensitive settings and user management
            const { data: defaultPermissions } = await supabaseClient
              .from('permissions')
              .select('id')
              .not('name', 'in', '("settings.manage","users.manage")');
            
            if (defaultPermissions && defaultPermissions.length > 0) {
              const rolePermissions = defaultPermissions.map(p => ({
                role_id: roleId,
                permission_id: p.id
              }));
              
              await supabaseClient
                .from('role_permissions')
                .insert(rolePermissions);
            }
          } else if (role === 'developer') {
            // Developer: API and webhook management
            const { data: defaultPermissions } = await supabaseClient
              .from('permissions')
              .select('id')
              .in('name', ['payments.view', 'customers.view', 'api_keys.view', 'api_keys.manage', 'webhooks.view', 'webhooks.manage', 'settings.view']);
            
            if (defaultPermissions && defaultPermissions.length > 0) {
              const rolePermissions = defaultPermissions.map(p => ({
                role_id: roleId,
                permission_id: p.id
              }));
              
              await supabaseClient
                .from('role_permissions')
                .insert(rolePermissions);
            }
          } else if (role === 'finance') {
            // Finance: payment and settlement related
            const { data: defaultPermissions } = await supabaseClient
              .from('permissions')
              .select('id')
              .in('name', ['payments.view', 'payments.create', 'payments.refund', 'customers.view', 'settlements.view', 'reports.view']);
            
            if (defaultPermissions && defaultPermissions.length > 0) {
              const rolePermissions = defaultPermissions.map(p => ({
                role_id: roleId,
                permission_id: p.id
              }));
              
              await supabaseClient
                .from('role_permissions')
                .insert(rolePermissions);
            }
          } else if (role === 'viewer') {
            // Viewer: read-only access
            const { data: defaultPermissions } = await supabaseClient
              .from('permissions')
              .select('id')
              .like('name', '%.view');
            
            if (defaultPermissions && defaultPermissions.length > 0) {
              const rolePermissions = defaultPermissions.map(p => ({
                role_id: roleId,
                permission_id: p.id
              }));
              
              await supabaseClient
                .from('role_permissions')
                .insert(rolePermissions);
            }
          }
        }
        // owner role gets all permissions by default in handle_new_user trigger
      }
    }

    if (!roleId) {
      if (!existingUser) {
        console.log('Cleaning up newly created user due to missing roleId');
        await supabaseClient.auth.admin.deleteUser(userId);
      }
      throw new Error(`ไม่พบบทบาท ${role} ในระบบ`);
    }

    // Create membership for the user
    const { error: membershipError } = await supabaseClient
      .from('memberships')
      .insert({
        user_id: userId,
        tenant_id: tenant_id,
        role_id: roleId as string,
      });

    console.log('Membership creation:', { membershipError });

    if (membershipError) {
      // Clean up: delete the created user if membership creation fails (only if we just created them)
      if (!existingUser) {
        console.log('Cleaning up newly created user due to membership error');
        await supabaseClient.auth.admin.deleteUser(userId);
      }
      throw membershipError;
    }

    console.log('Admin user created/added successfully:', userId);

    // Generate temporary code for new users only
    let invitationCode = null;
    let codeExpiresAt = null;
    
    if (!existingUser) {
      const { data: tempCodeData, error: tempCodeError } = await supabaseClient.functions.invoke(
        'temporary-code-generate',
        {
          body: {
            user_id: userId,
            tenant_id: tenant_id,
            purpose: 'onboard_invite',
            issued_from_context: 'owner_create_member',
            expires_in_hours: 72,
          },
        }
      );

      if (tempCodeError) {
        console.error('Failed to generate temporary code:', tempCodeError);
      } else {
        invitationCode = tempCodeData?.code;
        codeExpiresAt = tempCodeData?.expires_at;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          public_id: public_id,
          email: email,
          full_name,
          role,
        },
        invitation_code: invitationCode,
        code_expires_at: codeExpiresAt,
        message: existingUser ? 'เพิ่มผู้ใช้เข้าเทนนันต์สำเร็จ' : 'สร้างผู้ใช้สำเร็จ',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[INTERNAL] Error creating admin user:', error);
    
    // SECURITY: Sanitize error messages
    const errorMessage = error instanceof Error 
      ? sanitizeErrorMessage(error)
      : 'An error occurred. Please contact support.';
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
