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

    // Get total and active clients count
    const { data: clients, error: clientsError } = await supabaseClient
      .from('shareholder_clients')
      .select('tenant_id, status')
      .eq('shareholder_id', shareholder.id);

    if (clientsError) throw clientsError;

    const totalOwners = clients?.length || 0;
    const activeOwners = clients?.filter(c => c.status === 'active').length || 0;

    // Get monthly commission revenue (current month)
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    const { data: monthlyCommissions, error: monthlyError } = await supabaseClient
      .from('shareholder_earnings')
      .select('amount')
      .eq('shareholder_id', shareholder.id)
      .gte('created_at', firstDayOfMonth);

    if (monthlyError) throw monthlyError;

    // Amount is in satang, convert to baht by dividing by 100
    const monthlyRefRevenue = monthlyCommissions?.reduce((sum, c) => sum + (Number(c.amount) / 100), 0) || 0;

    // Get pending commission (from shareholder balance)
    const { data: shareholderData, error: balanceError } = await supabaseClient
      .from('shareholders')
      .select('balance')
      .eq('id', shareholder.id)
      .single();

    if (balanceError) throw balanceError;

    // Balance is in satang, convert to baht by dividing by 100
    const pendingCommission = Number(shareholderData?.balance || 0) / 100;

    // Calculate approval rate (active / total)
    const approvalRate = totalOwners > 0 ? Math.round((activeOwners / totalOwners) * 100) : 0;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          totalOwners,
          activeOwners,
          monthlyRefRevenue,
          pendingCommission,
          approvalRate
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in shareholder-referral-stats:', error);
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
