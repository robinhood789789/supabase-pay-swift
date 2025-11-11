import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { ShareholderCreateRequest } from '../_shared/types.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

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

    // Get auth user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is super admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      throw new Error('Only super admins can create shareholders');
    }

    // Get request body
    const { email, fullName, phone, commissionRate, notes } = await req.json();

    if (!email || !fullName) {
      throw new Error('Email and full name are required');
    }

    // Create auth user for shareholder
    const tempPassword = `Temp${Math.random().toString(36).substring(2, 15)}!`;
    
    const { data: newUser, error: createUserError } = await supabaseClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'shareholder'
      }
    });

    if (createUserError) {
      console.error('Error creating user:', createUserError);
      throw new Error(`Failed to create user: ${createUserError.message}`);
    }

    // Create shareholder record
    const { data: shareholder, error: shareholderError } = await supabaseClient
      .from('shareholders')
      .insert({
        user_id: newUser.user.id,
        full_name: fullName,
        email,
        phone: phone || null,
        created_by: user.id,
        notes: notes || null,
        status: 'active'
      })
      .select()
      .single();

    if (shareholderError) {
      console.error('Error creating shareholder:', shareholderError);
      // Cleanup: delete the auth user if shareholder creation failed
      await supabaseClient.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Failed to create shareholder: ${shareholderError.message}`);
    }

    console.log(`Shareholder created successfully: ${shareholder.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        shareholder: {
          id: shareholder.id,
          email: shareholder.email,
          full_name: shareholder.full_name,
          temporary_password: tempPassword
        },
        message: 'Shareholder created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in shareholder-create:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
