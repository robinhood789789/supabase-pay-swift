import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Verify secret key (for security)
    const SUPER_ADMIN_SECRET = Deno.env.get('SUPER_ADMIN_CREATION_SECRET') || 'create-super-admin-secret-2024';
    
    if (secret_key !== SUPER_ADMIN_SECRET) {
      throw new Error('Invalid secret key');
    }

    if (!email || !new_password) {
      throw new Error('Missing required fields: email, new_password');
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
    console.error('Error in reset-super-admin-password function:', error);
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
