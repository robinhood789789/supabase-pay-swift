import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { requireStepUp } from '../_shared/mfa-guards.ts';
import { 
  createSecureErrorResponse, 
  logSecureAction, 
  validateEmail, 
  validateLength 
} from '../_shared/error-handling.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { PartnerCreateRequest } from '../_shared/types.ts';

// Generate secure random password
function generateTempPassword(): string {
  const length = 16;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const all = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Generate magic link token
function generateMagicToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  console.log('[platform-partners-create] === REQUEST RECEIVED ===');
  console.log('[platform-partners-create] Method:', req.method);
  console.log('[platform-partners-create] Headers:', Object.fromEntries(req.headers));
  
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    console.log('[platform-partners-create] Handling CORS preflight');
    return corsResponse;
  }

  try {
    console.log('[platform-partners-create] Starting main handler...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    console.log('[platform-partners-create] Environment check - URL exists:', !!supabaseUrl);
    
    // Client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get JWT token from header
    const authBearer = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    if (!authBearer || !authBearer.startsWith('Bearer ')) {
      console.error('[platform-partners-create] Missing or invalid Authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const token = authBearer.replace('Bearer ', '').trim();
    
    console.log('[platform-partners-create] Verifying JWT token...');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    console.log('[platform-partners-create] Auth result:', { userId: user?.id, hasError: !!authError });
    
    if (authError || !user) {
      console.error('[platform-partners-create] Auth failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Super Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step-Up MFA required
    console.log('[platform-partners-create] Checking MFA for user:', user.id);
    const mfaCheck = await requireStepUp({
      supabase: supabaseAdmin,
      userId: user.id,
      action: 'roles',
      userRole: 'super_admin',
      isSuperAdmin: true,
    });

    if (!mfaCheck.ok) {
      console.error('[platform-partners-create] MFA check failed:', mfaCheck);
      return new Response(JSON.stringify({ error: mfaCheck.message, code: mfaCheck.code }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[platform-partners-create] MFA check passed');

    const {
      display_name,
      email,
      commission_type = 'revenue_share',
      commission_percent = 10,
      bounty_amount = 0,
      adjust_min_percent = 0,
      adjust_max_percent = 30,
      allow_self_adjust = false,
      linked_tenants = [],
    } = await req.json();

    // Validate inputs
    if (!display_name || !email) {
      return new Response(JSON.stringify({ error: 'Display name and email are required', code: 'VALIDATION_ERROR' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return new Response(JSON.stringify({ error: emailValidation.error, code: 'VALIDATION_ERROR' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate display name length
    const nameValidation = validateLength(display_name, 'Display name', 100);
    if (!nameValidation.valid) {
      return new Response(JSON.stringify({ error: nameValidation.error, code: 'VALIDATION_ERROR' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate commission percent
    if (commission_percent < 0 || commission_percent > 100) {
      return new Response(JSON.stringify({ error: 'Commission percentage must be between 0 and 100', code: 'VALIDATION_ERROR' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logSecureAction('platform-partners-create', 'Creating partner', { display_name, email, commission_type });

    // Check if email already exists
    console.log('[platform-partners-create] Checking if email exists...');
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    if (existingUser?.users.some(u => u.email === email)) {
      console.error('[platform-partners-create] Email already exists:', email);
      return new Response(JSON.stringify({ error: 'Email already exists' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate temp password
    const tempPassword = generateTempPassword();

    // Create auth user
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: display_name,
      },
    });

    if (createUserError || !newUser.user) {
      console.error('Failed to create user:', createUserError);
      return new Response(JSON.stringify({ error: 'Failed to create user account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update profile to set requires_password_change
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        requires_password_change: true,
      })
      .eq("id", newUser.user.id);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
      // Continue anyway - password change will be enforced at login
    }

    // Create shareholder record
    const { data: shareholder, error: shareholderError } = await supabaseAdmin
      .from('shareholders')
      .insert({
        user_id: newUser.user.id,
        full_name: display_name,
        email: email,
        status: 'active',
        default_commission_type: commission_type,
        default_commission_value: commission_percent,
        allow_self_adjust,
        adjust_min_percent,
        adjust_max_percent,
        balance: 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (shareholderError) {
      console.error('Failed to create shareholder:', shareholderError);
      // Rollback user creation
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: 'Failed to create shareholder record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Link tenants if provided
    if (linked_tenants && linked_tenants.length > 0) {
      const links = linked_tenants.map((link: any) => ({
        shareholder_id: shareholder.id,
        tenant_id: link.tenant_id,
        commission_rate: link.commission_rate || commission_percent,
        commission_type: link.commission_type || commission_type,
        bounty_amount: link.bounty_amount || bounty_amount,
        effective_from: link.effective_from || new Date().toISOString(),
        status: 'active',
      }));

      const { error: linksError } = await supabaseAdmin
        .from('shareholder_clients')
        .insert(links);

      if (linksError) {
        console.error('Failed to link tenants:', linksError);
        // Continue anyway - can be linked later
      }
    }

    // Generate temporary code
    const { data: tempCodeData, error: tempCodeError } = await supabaseAdmin.functions.invoke(
      'temporary-code-generate',
      {
        body: {
          user_id: newUser.user.id,
          purpose: 'onboard_invite',
          issued_from_context: 'platform_partners_create',
          expires_in_hours: 72,
        },
      }
    );

    if (tempCodeError || !tempCodeData?.code) {
      console.error('Failed to generate temporary code:', tempCodeError);
      // Continue anyway - user can be given temp password
    }

    const invitationCode = tempCodeData?.code || null;

    // Store invitation token for backwards compatibility
    const magicToken = generateMagicToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await supabaseAdmin
      .from('shareholder_invitations')
      .insert({
        shareholder_id: shareholder.id,
        email,
        magic_token: magicToken,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    const inviteLink = `${supabaseUrl.replace('//', '//app.')}/auth/claim-code`;

    // Send invitation email
    try {
      const inviteResponse = await supabaseAdmin.functions.invoke('send-partner-invitation', {
        body: {
          email,
          display_name,
          invitation_code: invitationCode,
          temp_password: tempPassword,
          invite_link: inviteLink,
        },
      });

      if (inviteResponse.error) {
        console.error('[platform-partners-create] Failed to send invitation:', inviteResponse.error);
        // Don't fail the entire operation if email fails
      } else {
        console.log('[platform-partners-create] Invitation email sent successfully');
      }
    } catch (emailError) {
      console.error('[platform-partners-create] Email sending error:', emailError);
      // Continue despite email error
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      action: 'partner.create',
      actor_user_id: user.id,
      after: {
        shareholder_id: shareholder.id,
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        display_name,
        commission_type,
        commission_percent,
        linked_tenants_count: linked_tenants?.length || 0,
        has_invitation_code: !!invitationCode,
      },
    });

    // DO NOT return temp_password in production - credentials sent via email only
    return new Response(
      JSON.stringify({
        success: true,
        shareholder_id: shareholder.id,
        invitation_code: invitationCode,
        invite_link: inviteLink,
        expires_at: expiresAt.toISOString(),
        instructions: invitationCode 
          ? 'Invitation email sent. User must sign in and use the invitation code to set their password.'
          : 'Invitation email sent. User must sign in with temporary password and will be prompted to change it.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return createSecureErrorResponse(error, 'platform-partners-create', corsHeaders);
  }
});
