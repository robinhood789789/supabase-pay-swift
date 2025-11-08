import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReconciliationResult {
  matched: number;
  unmatched: number;
  discrepancies: Array<{
    row: number;
    amount: number;
    reference?: string;
    date?: string;
    reason: string;
  }>;
  settlementId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's tenant
    const { data: membership } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      throw new Error('No tenant found');
    }

    const tenantId = membership.tenant_id;

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const provider = formData.get('provider') as string;
    const cycle = formData.get('cycle') as string;
    const dateWindowDays = parseInt(formData.get('dateWindowDays') as string || '3');

    if (!file) {
      throw new Error('No file uploaded');
    }

    console.log(`Processing reconciliation file: ${file.name}, provider: ${provider}, cycle: ${cycle}`);

    // Read file content
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('File must contain headers and at least one data row');
    }

    // Parse CSV (simple parser - assumes comma-separated with headers)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('total'));
    const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('id') || h.includes('transaction'));
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('time'));
    const feeIdx = headers.findIndex(h => h.includes('fee'));

    if (amountIdx === -1) {
      throw new Error('Could not find amount column in CSV');
    }

    console.log(`Column indices - amount: ${amountIdx}, ref: ${refIdx}, date: ${dateIdx}, fee: ${feeIdx}`);

    const result: ReconciliationResult = {
      matched: 0,
      unmatched: 0,
      discrepancies: []
    };

    let totalFees = 0;
    let totalNetAmount = 0;

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim());
      
      // Parse amount (remove currency symbols and convert to cents)
      const amountStr = row[amountIdx]?.replace(/[^0-9.-]/g, '') || '0';
      const amount = Math.round(parseFloat(amountStr) * 100); // Convert to cents
      
      const reference = refIdx !== -1 ? row[refIdx] : undefined;
      const dateStr = dateIdx !== -1 ? row[dateIdx] : undefined;
      const fee = feeIdx !== -1 ? Math.round(parseFloat(row[feeIdx]?.replace(/[^0-9.-]/g, '') || '0') * 100) : 0;

      totalFees += fee;
      totalNetAmount += amount;

      console.log(`Row ${i}: amount=${amount}, ref=${reference}, date=${dateStr}, fee=${fee}`);

      // Build query to find matching payment
      let query = supabase
        .from('payments')
        .select('id, amount, metadata, paid_at, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'paid');

      // Match by amount
      query = query.eq('amount', amount);

      // Match by reference if available
      if (reference) {
        query = query.or(`provider_payment_id.eq.${reference},metadata->reference.eq.${reference}`);
      }

      // Match by date window if available
      if (dateStr && dateIdx !== -1) {
        try {
          const targetDate = new Date(dateStr);
          const startDate = new Date(targetDate);
          startDate.setDate(startDate.getDate() - dateWindowDays);
          const endDate = new Date(targetDate);
          endDate.setDate(endDate.getDate() + dateWindowDays);

          query = query.gte('paid_at', startDate.toISOString())
                       .lte('paid_at', endDate.toISOString());
        } catch (e) {
          console.warn(`Could not parse date: ${dateStr}`, e);
        }
      }

      const { data: payments } = await query.limit(1);

      if (payments && payments.length > 0) {
        result.matched++;
        console.log(`Matched payment ${payments[0].id} for row ${i}`);
      } else {
        result.unmatched++;
        result.discrepancies.push({
          row: i,
          amount: amount / 100,
          reference,
          date: dateStr,
          reason: 'No matching payment found'
        });
        console.log(`No match for row ${i}`);
      }
    }

    // Create settlement record
    const { data: settlement, error: settlementError } = await supabase
      .from('settlements')
      .insert({
        tenant_id: tenantId,
        provider: provider || 'unknown',
        cycle: cycle || new Date().toISOString().split('T')[0],
        paid_out_at: new Date().toISOString(),
        fees: totalFees,
        net_amount: totalNetAmount
      })
      .select()
      .single();

    if (settlementError) {
      console.error('Error creating settlement:', settlementError);
    } else {
      result.settlementId = settlement.id;
      console.log(`Created settlement ${settlement.id}`);
    }

    console.log(`Reconciliation complete: ${result.matched} matched, ${result.unmatched} unmatched`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Reconciliation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
