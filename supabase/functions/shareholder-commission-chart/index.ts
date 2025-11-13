import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get auth user
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

    // Get shareholder info
    const { data: shareholder, error: shareholderError } = await supabaseClient
      .from('shareholders')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (shareholderError || !shareholder) {
      throw new Error('Not a shareholder');
    }

    // Get query params
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '6M';

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (range) {
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '12M':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 6);
    }

    // Get commission earnings in the date range
    const { data: commissions, error: commissionsError } = await supabaseClient
      .from('shareholder_earnings')
      .select('created_at, amount')
      .eq('shareholder_id', shareholder.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (commissionsError) throw commissionsError;

    // Group by date (daily aggregation)
    const groupedData = new Map<string, number>();
    
    commissions?.forEach(c => {
      const date = new Date(c.created_at).toISOString().split('T')[0];
      const current = groupedData.get(date) || 0;
      // Convert satang to baht by dividing by 100
      groupedData.set(date, current + (Number(c.amount) / 100));
    });

    // Convert to array format for chart
    const chartData = Array.from(groupedData.entries())
      .map(([date, commissionTHB]) => ({
        date,
        commissionTHB: Math.round(commissionTHB)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return new Response(
      JSON.stringify({
        success: true,
        data: chartData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in shareholder-commission-chart:', error);
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
