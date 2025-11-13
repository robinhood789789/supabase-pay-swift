import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders, handleCorsPreflight, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

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

    const { code_id } = await req.json();

    if (!code_id) {
      return new Response(JSON.stringify({ error: 'code_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch code and verify ownership
    const { data: tempCode, error: fetchError } = await supabaseAdmin
      .from('temporary_codes')
      .select('*')
      .eq('id', code_id)
      .maybeSingle();

    if (fetchError || !tempCode) {
      return new Response(JSON.stringify({ error: 'Code not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check permission (must be issuer or super admin)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    const canRevoke = tempCode.issued_by === user.id || profile?.is_super_admin;

    if (!canRevoke) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Revoke code
    const { error: revokeError } = await supabaseAdmin
      .from('temporary_codes')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', code_id);

    if (revokeError) {
      console.error('Revoke error:', revokeError);
      return new Response(JSON.stringify({ error: 'Failed to revoke code' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: tempCode.tenant_id,
      actor_user_id: user.id,
      action: 'temporary_code.revoked',
      target: code_id,
      before: { is_active: true },
      after: { is_active: false },
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Code revoked successfully' 
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
