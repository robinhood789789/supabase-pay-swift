import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { requireStepUp } from '../_shared/mfa-guards.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
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

    const url = new URL(req.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const partnerId = url.searchParams.get('partner_id');

    // Count records first
    let countQuery = supabase
      .from('shareholder_commission_events')
      .select('*', { count: 'exact', head: true });

    if (startDate) countQuery = countQuery.gte('occurred_at', startDate);
    if (endDate) countQuery = countQuery.lte('occurred_at', endDate + 'T23:59:59');
    if (partnerId) countQuery = countQuery.eq('shareholder_id', partnerId);

    const { count } = await countQuery;

    // MFA required for >5000 rows
    if (count && count > 5000) {
      const mfaCheck = await requireStepUp({
        supabase,
        userId: user.id,
        action: 'export-large',
        userRole: 'super_admin',
        isSuperAdmin: true,
      });
      if (!mfaCheck.ok) {
        return new Response(JSON.stringify({ error: mfaCheck.message, code: mfaCheck.code }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch all events
    let query = supabase
      .from('shareholder_commission_events')
      .select(`
        id,
        shareholder_id,
        tenant_id,
        event_type,
        base_value,
        commission_percent,
        commission_amount,
        occurred_at,
        source_id,
        created_at,
        shareholder:shareholders(full_name),
        tenant:tenants(name)
      `);

    if (startDate) query = query.gte('occurred_at', startDate);
    if (endDate) query = query.lte('occurred_at', endDate + 'T23:59:59');
    if (partnerId) query = query.eq('shareholder_id', partnerId);

    const { data: events, error: eventsError } = await query.order('occurred_at', { ascending: false });

    if (eventsError) throw eventsError;

    // Generate CSV
    const headers = [
      'Event ID',
      'Partner',
      'Tenant',
      'Event Type',
      'Base Value',
      'Commission %',
      'Commission Amount',
      'Occurred At',
      'Source ID',
    ];

    const rows = events?.map((e: any) => [
      e.id,
      e.shareholder?.full_name || 'Unknown',
      e.tenant?.name || 'Unknown',
      e.event_type,
      e.base_value,
      e.commission_percent,
      e.commission_amount,
      e.occurred_at,
      e.source_id || '',
    ]) || [];

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Calculate checksum
    const encoder = new TextEncoder();
    const data = encoder.encode(csv);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await supabase.from('audit_logs').insert({
      action: 'platform.partner_reports.export',
      actor_user_id: user.id,
      after: { row_count: events?.length, checksum, start_date: startDate, end_date: endDate },
    });

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="partner-commission-events-${Date.now()}.csv"`,
        'X-Checksum': checksum,
      },
    });
  } catch (error) {
    console.error('Error in platform-partner-reports-export:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
