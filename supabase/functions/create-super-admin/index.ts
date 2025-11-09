import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireCSRF } from '../_shared/csrf-validation.ts';
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token, cookie',
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
    const { email, password, full_name, secret_key } = await req.json();

    // SECURITY: Rate limiting (3 attempts per hour from this IP)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `create-super-admin:${clientIp}`;
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

    if (!email || !password || !full_name) {
      throw new Error('Missing required fields: email, password, full_name');
    }

    // SECURITY: Input validation
    try {
      validateFields([
        () => validateEmail(email),
        () => validatePassword(password),
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

    console.log('Creating new super admin user:', email);

    // Create the new user with auth
    const { data: newUser, error: createUserError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (createUserError) {
      console.error('Error creating user:', createUserError);
      throw new Error(`Failed to create user: ${createUserError.message}`);
    }

    console.log('User created successfully:', newUser.user.id);

    // Update profile to set is_super_admin = true
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ is_super_admin: true })
      .eq('id', newUser.user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    console.log('Super admin privileges granted successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name,
        },
        message: 'Super admin created successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[INTERNAL] Error in create-super-admin function:', error);
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
