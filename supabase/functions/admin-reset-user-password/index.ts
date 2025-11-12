import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { requireMFA } from '../_shared/mfa-guards.ts';
import { validateFields, validateString, ValidationException, sanitizeErrorMessage } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and MFA
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    // Verify authentication via Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check MFA
    await requireMFA(user.id);

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user is super admin or has user management permission
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      // Check if user has permission to manage users in their tenant
      const { data: permission } = await supabaseClient
        .from('user_permissions')
        .select('permission:permissions(name)')
        .eq('user_id', user.id)
        .eq('permission.name', 'users.manage')
        .single();

      if (!permission) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Parse request
    const { user_id, new_password } = await req.json();

    // Validate inputs
    validateFields([
      () => validateString('user_id', user_id, { required: true }),
      () => validateString('new_password', new_password, { 
        required: true,
        minLength: 12,
        maxLength: 128,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
        patternMessage: 'Password must contain uppercase, lowercase, number, and special character'
      }),
    ]);

    // Get target user
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, public_id, full_name, email, is_super_admin')
      .eq('id', user_id)
      .single();

    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent resetting super admin password unless requester is also super admin
    if (targetUser.is_super_admin && !profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: 'Cannot reset super admin password' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { 
        password: new_password,
      }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    // Set requires_password_change flag
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        requires_password_change: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: user.id,
      action: 'password_reset',
      target: 'user',
      tenant_id: null,
      before: { user_id: targetUser.id },
      after: { 
        user_id: targetUser.id, 
        public_id: targetUser.public_id,
        requires_password_change: true 
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully',
        user_id: targetUser.id,
        public_id: targetUser.public_id,
        requires_password_change: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in admin-reset-user-password:', error);
    
    if (error instanceof ValidationException) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errorMessage = error instanceof Error ? sanitizeErrorMessage(error) : 'An error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});