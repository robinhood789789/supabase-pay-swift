import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { 
  validateEmail, 
  validatePassword,
  validateFields,
  ValidationException,
  sanitizeErrorMessage
} from '../_shared/validation.ts';

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { email, new_password, secret_key } = await req.json();

    // SECURITY: Rate limiting (3 password resets per hour from this IP)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `reset-super-admin:${clientIp}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 3, 3600000, 0);
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 3 attempts per hour.',
          remaining: 0
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify secret key (CRITICAL SECURITY: No default value)
    const SUPER_ADMIN_SECRET = Deno.env.get('SUPER_ADMIN_CREATION_SECRET');
    
    if (!SUPER_ADMIN_SECRET) {
      console.error('SUPER_ADMIN_CREATION_SECRET not configured');
      throw new Error('Server configuration error');
    }
    
    if (secret_key !== SUPER_ADMIN_SECRET) {
      throw new Error('Invalid secret key');
    }

    if (!email || !new_password) {
      throw new Error('Missing required fields: email, new_password');
    }

    // SECURITY: Input validation
    try {
      validateFields([
        () => validateEmail(email),
        () => validatePassword(new_password),
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

    console.log('Resetting password for super admin:', email);

    // Verify the user is actually a super admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, is_super_admin')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      throw new Error('User not found');
    }

    if (!profile.is_super_admin) {
      throw new Error('User is not a super admin');
    }

    console.log('User verified as super admin:', profile.id);

    // Update the password using admin API
    const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
      profile.id,
      { password: new_password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    console.log('Password updated successfully for user:', profile.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully',
        user_id: profile.id,
        email: email,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[INTERNAL] Error in reset-super-admin-password function:', error);
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
