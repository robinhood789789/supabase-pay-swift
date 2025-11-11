import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant, x-csrf-token, cookie',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Generate secure random code (format: XXXX-XXXX)
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  const segments = 2;
  const segmentLength = 4;
  
  const code = Array(segments)
    .fill(null)
    .map(() => {
      return Array(segmentLength)
        .fill(null)
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');
    })
    .join('-');
  
  return code;
}

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

    const {
      user_id,
      tenant_id,
      purpose = 'onboard_invite',
      issued_from_context,
      expires_in_hours = 72,
      metadata = {},
    } = await req.json();

    // Validate inputs
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique code (retry if collision)
    let code = '';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      code = generateCode();
      
      const { data: existing } = await supabaseAdmin
        .from('temporary_codes')
        .select('id')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (!existing) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return new Response(JSON.stringify({ error: 'Failed to generate unique code' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expires_in_hours);

    // Insert temporary code
    const { data: tempCode, error: insertError } = await supabaseAdmin
      .from('temporary_codes')
      .insert({
        tenant_id,
        user_id,
        code,
        purpose,
        issued_by: user.id,
        issued_from_context,
        expires_at: expiresAt.toISOString(),
        metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to generate code' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id,
      actor_user_id: user.id,
      action: 'temporary_code.generated',
      target: user_id,
      after: { code_id: tempCode.id, purpose },
    });

    return new Response(JSON.stringify({ 
      success: true,
      code: tempCode.code,
      expires_at: tempCode.expires_at,
      code_id: tempCode.id,
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
