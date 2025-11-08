import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestAccount {
  userId: string;
  fullName: string;
  password: string;
  role?: string;
  isSuperAdmin?: boolean;
  tenantId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { secret_key } = await req.json();

    // Verify secret key
    const BOOTSTRAP_SECRET = Deno.env.get('BOOTSTRAP_SECRET') || 'bootstrap-test-2024';
    if (secret_key !== BOOTSTRAP_SECRET) {
      throw new Error('Invalid secret key');
    }

    console.log('Starting bootstrap test accounts...');

    // Clean up existing test accounts first
    console.log('Cleaning up existing test accounts...');
    const testUserIds = ['SADM-000001', 'SHLD-000001', 'OWNR-000001', 'VIEW-000001', 'MNGR-000001', 'FINC-000001', 'DEVL-000001'];
    
    for (const userId of testUserIds) {
      const email = `${userId}@system.local`;
      
      // Try to find and delete the user
      try {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
        
        if (existingUser) {
          console.log(`Deleting existing user: ${userId}`);
          await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
        }
      } catch (cleanupError) {
        console.log(`Cleanup warning for ${userId}:`, cleanupError);
        // Continue even if cleanup fails
      }
    }

    // Also clean up test tenant and shareholder
    try {
      const { data: testTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('name', 'Test Company Ltd.')
        .maybeSingle();
      
      if (testTenant) {
        console.log('Deleting existing test tenant...');
        await supabaseAdmin.from('tenants').delete().eq('id', testTenant.id);
      }
    } catch (err) {
      console.log('Cleanup warning for tenant:', err);
    }

    console.log('Cleanup complete, creating new accounts...');

    const accounts: TestAccount[] = [];
    const testPassword = 'TempPass123!'; // Temporary password for all accounts

    // 1. Create Super Admin
    const superAdminUser = await createUser(supabaseAdmin, {
      userId: 'SADM-000001',
      fullName: 'Super Admin',
      password: testPassword,
      isSuperAdmin: true,
    });
    accounts.push({
      userId: 'SADM-000001',
      fullName: 'Super Admin',
      password: testPassword,
      role: 'Super Admin',
    });

    // 2. Create Shareholder
    const shareholderUser = await createUser(supabaseAdmin, {
      userId: 'SHLD-000001',
      fullName: 'Shareholder Manager',
      password: testPassword,
    });
    
    // Create shareholder record
    const { data: shareholder, error: shareholderError } = await supabaseAdmin
      .from('shareholders')
      .insert({
        user_id: shareholderUser.id,
        full_name: 'Shareholder Manager',
        email: `SHLD-000001@system.local`,
        status: 'active',
        created_by: superAdminUser.id,
      })
      .select()
      .single();

    if (shareholderError) {
      console.error('Error creating shareholder:', shareholderError);
    }

    accounts.push({
      userId: 'SHLD-000001',
      fullName: 'Shareholder Manager',
      password: testPassword,
      role: 'Shareholder',
    });

    // 3. Create Tenant (Company) with Owner
    const ownerUser = await createUser(supabaseAdmin, {
      userId: 'OWNR-000001',
      fullName: 'Owner User',
      password: testPassword,
    });

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: 'Test Company Ltd.',
        public_id: 'TNT-000001',
        status: 'active',
        referred_by_shareholder_id: shareholder?.id,
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      throw new Error(`Failed to create tenant: ${tenantError.message}`);
    }

    // Get owner role
    const { data: ownerRole } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .single();

    if (!ownerRole) {
      throw new Error('Owner role not found');
    }

    // Create membership for owner
    await supabaseAdmin.from('memberships').insert({
      user_id: ownerUser.id,
      tenant_id: tenant.id,
      role_id: ownerRole.id,
    });

    accounts.push({
      userId: 'OWNR-000001',
      fullName: 'Owner User',
      password: testPassword,
      role: 'Owner',
      tenantId: tenant.public_id,
    });

    // 4-7. Create Admin users in the tenant
    const adminRoles = [
      { userId: 'VIEW-000001', fullName: 'Viewer Admin', role: 'viewer' },
      { userId: 'MNGR-000001', fullName: 'Manager Admin', role: 'manager' },
      { userId: 'FINC-000001', fullName: 'Finance Admin', role: 'finance' },
      { userId: 'DEVL-000001', fullName: 'Developer Admin', role: 'developer' },
    ];

    for (const adminRole of adminRoles) {
      const adminUser = await createUser(supabaseAdmin, {
        userId: adminRole.userId,
        fullName: adminRole.fullName,
        password: testPassword,
        tenantId: tenant.id,
      });

      // Get role
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('name', adminRole.role)
        .single();

      if (role) {
        await supabaseAdmin.from('memberships').insert({
          user_id: adminUser.id,
          tenant_id: tenant.id,
          role_id: role.id,
        });
      }

      accounts.push({
        userId: adminRole.userId,
        fullName: adminRole.fullName,
        password: testPassword,
        role: adminRole.role.charAt(0).toUpperCase() + adminRole.role.slice(1),
        tenantId: tenant.public_id,
      });
    }

    // Link shareholder to tenant
    if (shareholder) {
      await supabaseAdmin.from('shareholder_clients').insert({
        shareholder_id: shareholder.id,
        tenant_id: tenant.id,
        commission_rate: 5.0,
        status: 'active',
        referral_source: 'bootstrap',
      });
    }

    console.log('Bootstrap completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test accounts created successfully',
        accounts,
        instructions: {
          th: 'ใช้ User ID และรหัสผ่านชั่วคราวด้านบนเพื่อเข้าสู่ระบบ หลังจากล็อกอินจะต้องสแกน QR code เข้า Google Authenticator และเปลี่ยนรหัสผ่าน',
          en: 'Use User ID and temporary password above to login. After login, you must scan QR code with Google Authenticator and change password',
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in bootstrap-test-accounts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function createUser(
  supabaseAdmin: any,
  params: {
    userId: string;
    fullName: string;
    password: string;
    isSuperAdmin?: boolean;
    tenantId?: string;
  }
) {
  const email = `${params.userId}@system.local`;

  console.log(`Creating user: ${params.userId} (${email})`);

  // Create auth user
  const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      full_name: params.fullName,
      user_id: params.userId,
    },
  });

  if (createUserError) {
    const code = (createUserError as any)?.code || (createUserError as any)?.status;
    if (code === 'email_exists' || (createUserError as any)?.status === 422) {
      const emailLower = email.toLowerCase();
      try {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list?.users?.find((u: any) => (u.email || '').toLowerCase() === emailLower);
        if (existing) {
          console.log(`User exists, reusing: ${params.userId} (${existing.id})`);
          return existing;
        }
      } catch (e) {
        console.log('Lookup existing user failed:', e);
      }
    }
    console.error(`Error creating user ${params.userId}:`, createUserError);
    throw new Error(`Failed to create user ${params.userId}: ${createUserError.message}`);
  }

  console.log(`User created: ${params.userId} with ID ${newUser.user.id}`);

  // Update profile
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      public_id: params.userId,
      is_super_admin: params.isSuperAdmin || false,
      requires_password_change: false, // Skip password change for test accounts
      totp_enabled: false, // Force MFA setup
    })
    .eq('id', newUser.user.id);

  if (updateError) {
    console.error(`Error updating profile for ${params.userId}:`, updateError);
  }

  return newUser.user;
}
