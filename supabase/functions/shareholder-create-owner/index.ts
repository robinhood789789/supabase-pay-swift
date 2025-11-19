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
    if (!authHeader) throw new Error('ไม่พบ authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('ไม่มีสิทธิ์เข้าถึง');

    // Verify user is an active shareholder
    const { data: shareholder, error: shareholderError } = await supabaseClient
      .from('shareholders')
      .select('id, referral_code')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (shareholderError || !shareholder) {
      throw new Error('ไม่ใช่ผู้ถือหุ้นที่ใช้งานอยู่');
    }

    // Parse request body
    const { business_name, email, public_id } = await req.json();

    if (!business_name) {
      throw new Error('กรุณากรอกชื่อธุรกิจ');
    }

    if (!public_id) {
      throw new Error('กรุณากรอก Public ID');
    }

    // Validate public_id format (PREFIX-NNNNNN)
    const publicIdRegex = /^[A-Z0-9]{2,6}-\d{6}$/;
    if (!publicIdRegex.test(public_id)) {
      throw new Error('รูปแบบ Public ID ไม่ถูกต้อง ต้องเป็น PREFIX-NNNNNN (เช่น OWA-123456)');
    }

    // Check if public_id already exists
    const { data: existingProfile, error: checkError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('public_id', public_id)
      .maybeSingle();

    if (checkError) {
      throw new Error(`ไม่สามารถตรวจสอบ Public ID ได้: ${checkError.message}`);
    }

    if (existingProfile) {
      throw new Error(`Public ID "${public_id}" ถูกใช้งานแล้ว กรุณาเลือก Public ID อื่น`);
    }

    // Check if public_id already exists in tenants
    const { data: existingTenant, error: tenantCheckError } = await supabaseClient
      .from('tenants')
      .select('id')
      .eq('public_id', public_id)
      .maybeSingle();

    if (tenantCheckError) {
      throw new Error(`ไม่สามารถตรวจสอบ Public ID ของเทนันท์ได้: ${tenantCheckError.message}`);
    }

    if (existingTenant) {
      throw new Error(`Public ID "${public_id}" ถูกใช้งานในเทนันท์แล้ว กรุณาเลือก Public ID อื่น`);
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
      throw new Error(`ไม่สามารถสร้างผู้ใช้ได้: ${createUserError?.message || 'ไม่ได้รับ User ID'}`);
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
      throw new Error(`ไม่สามารถตั้งค่า Public ID ได้: ${profileError.message}`);
    }

    // Create tenant using the provided public_id
    const tenantId = crypto.randomUUID();
    const { data: createdTenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .insert({
        id: tenantId,
        name: business_name,
        public_id: public_id,
        user_id: public_id,
        status: 'trial'
      })
      .select()
      .single();

    if (tenantError || !createdTenant) {
      console.error('Tenant creation error:', tenantError);
      throw new Error(`ไม่สามารถสร้างเทนันท์ได้: ${tenantError?.message || 'ไม่ได้รับข้อมูลเทนันท์'}`);
    }
    const finalTenantId = (createdTenant as any).id as string;
    console.log('Tenant created successfully:', finalTenantId);

    // Verify tenant exists before proceeding
    const { data: verifyTenant, error: verifyErr } = await supabaseClient
      .from('tenants')
      .select('id')
      .eq('id', finalTenantId)
      .maybeSingle();
    if (verifyErr || !verifyTenant) {
      console.error('Tenant verification failed:', verifyErr);
      throw new Error('ไม่พบเทนันท์หลังจากสร้างแล้ว');
    }

    // Find existing owner role (roles are global)
    const { data: ownerRole, error: ownerRoleError } = await supabaseClient
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .maybeSingle();

    if (ownerRoleError || !ownerRole?.id) {
      console.error('Owner role lookup error:', ownerRoleError);
      throw new Error(`ไม่พบบทบาท Owner: ${ownerRoleError?.message || 'ไม่พบบทบาท'}`);
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
      throw new Error(`ไม่สามารถสร้าง Membership ได้: ${membershipError?.message || 'ไม่ได้รับข้อมูล Membership'}`);
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
      throw new Error(`ไม่สามารถเชื่อมโยงผู้ถือหุ้นได้: ${linkError?.message || 'ไม่ได้รับข้อมูลการเชื่อมโยง'}`);
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
        tenant_id: finalTenantId,
        provider: 'stripe',
      });

    // Create tenant wallet
    await supabaseClient
      .from('tenant_wallets')
      .insert({
        tenant_id: finalTenantId,
        balance: 0,
      });

    // Audit log
    await supabaseClient
      .from('audit_logs')
      .insert({
        tenant_id: finalTenantId,
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
          tenant_id: finalTenantId,
          public_id: public_id,
          business_name: business_name,
          email: generated_email,
          temporary_password: tempPassword,
          message: 'สร้างผู้ใช้ Owner สำเร็จ กรุณาส่งรหัสผ่านชั่วคราวให้กับผู้ใช้อย่างปลอดภัย',
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error creating owner:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'ไม่สามารถสร้างผู้ใช้ Owner ได้'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
