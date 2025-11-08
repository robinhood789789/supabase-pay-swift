import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code, new_password } = await req.json();

    // Validate inputs
    if (!code || !new_password) {
      return new Response(JSON.stringify({ error: 'Code and new password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate code format (XXXX-XXXX pattern)
    const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(sanitizedCode)) {
      return new Response(JSON.stringify({ error: 'Invalid code format. Expected format: XXXX-XXXX' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Password strength validation
    if (new_password.length < 10) {
      return new Response(JSON.stringify({ error: 'Password must be at least 10 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hasUpper = /[A-Z]/.test(new_password);
    const hasLower = /[a-z]/.test(new_password);
    const hasNumber = /[0-9]/.test(new_password);

    if (!hasUpper || !hasLower || !hasNumber) {
      return new Response(JSON.stringify({ 
        error: 'Password must contain uppercase, lowercase, and number' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch and validate temporary code
    const { data: tempCode, error: fetchError } = await supabaseAdmin
      .from('temporary_codes')
      .select('*')
      .eq('code', sanitizedCode)
      .eq('is_active', true)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !tempCode) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry
    if (new Date(tempCode.expires_at) < new Date()) {
      await supabaseAdmin
        .from('temporary_codes')
        .update({ is_active: false })
        .eq('id', tempCode.id);

      return new Response(JSON.stringify({ error: 'Code has expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check usage limit
    if (tempCode.uses_count >= tempCode.max_uses) {
      return new Response(JSON.stringify({ error: 'Code has been used' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: new_password }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update password' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update profile
    await supabaseAdmin
      .from('profiles')
      .update({
        requires_password_change: false,
        password_set_at: new Date().toISOString(),
        onboard_completed: true,
      })
      .eq('id', user.id);

    // Mark code as used
    await supabaseAdmin
      .from('temporary_codes')
      .update({
        uses_count: tempCode.uses_count + 1,
        is_active: false,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', tempCode.id);

    // Audit logs
    await supabaseAdmin.from('audit_logs').insert([
      {
        tenant_id: tempCode.tenant_id,
        actor_user_id: user.id,
        action: 'temporary_code.claimed',
        target: tempCode.id,
        after: { purpose: tempCode.purpose },
      },
      {
        tenant_id: tempCode.tenant_id,
        actor_user_id: user.id,
        action: 'user.password_set',
        target: user.id,
      },
    ]);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Password set successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
