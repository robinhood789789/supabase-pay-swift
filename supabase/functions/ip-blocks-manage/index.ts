import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { IpBlockRequest, IpUnblockRequest } from '../_shared/types.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const method = req.method;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // List blocked IPs
    if (method === 'GET') {
      const { data: blocks, error } = await supabase
        .from('ip_blocks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching IP blocks:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch IP blocks' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ blocks }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block IP
    if (method === 'POST' && action === 'block') {
      const body: IpBlockRequest = await req.json();

      if (!body.ipAddress || !body.reason) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: ipAddress, reason' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const blockedUntil = body.isPermanent 
        ? null 
        : new Date(Date.now() + (body.durationMinutes || 60) * 60 * 1000).toISOString();

      const { data: block, error } = await supabase
        .from('ip_blocks')
        .insert({
          ip_address: body.ipAddress,
          reason: body.reason,
          blocked_until: blockedUntil,
          is_permanent: body.isPermanent || false,
          blocked_by: user.id,
          metadata: { manual_block: true },
        })
        .select()
        .single();

      if (error) {
        console.error('Error blocking IP:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to block IP' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[IP Blocked]', {
        ip: body.ipAddress,
        reason: body.reason,
        blockedBy: user.id,
      });

      return new Response(
        JSON.stringify({ success: true, block }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unblock IP
    if (method === 'POST' && action === 'unblock') {
      const body: IpUnblockRequest = await req.json();

      if (!body.ipAddress) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: ipAddress' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('ip_blocks')
        .delete()
        .eq('ip_address', body.ipAddress);

      if (error) {
        console.error('Error unblocking IP:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to unblock IP' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[IP Unblocked]', {
        ip: body.ipAddress,
        unblockedBy: user.id,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('IP blocks management error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
