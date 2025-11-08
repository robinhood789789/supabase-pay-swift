import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireStepUp, createMfaError } from '../_shared/mfa-guards.ts';
import { checkRateLimit } from '../_shared/concurrency.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
};

interface ReconciliationMatch {
  paymentId: string;
  statementRow: number;
  matchScore: number;
  matchReasons: string[];
}

interface ReconciliationDiscrepancy {
  row: number;
  amount: number;
  currency?: string;
  reference?: string;
  date?: string;
  reasons: string[];
}

interface ReconciliationResult {
  matched: number;
  unmatched: number;
  partialMatches: number;
  matches: ReconciliationMatch[];
  discrepancies: ReconciliationDiscrepancy[];
  settlementId?: string;
  totalAmount: number;
  totalFees: number;
  requestId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[Reconcile:${requestId}] Starting reconciliation`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get tenant from headers
    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      throw new Error('Missing X-Tenant header');
    }

    // Check permissions
    const { data: membership } = await supabase
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      throw new Error('Not a member of this tenant');
    }

    const userRole = (membership.roles as any)?.name;

    // MFA step-up for reconciliation (large data operations)
    const mfaCheck = await requireStepUp({
      supabase: supabase as any,
      userId: user.id,
      tenantId,
      action: 'reconciliation',
      userRole
    });

    if (!mfaCheck.ok) {
      return createMfaError(mfaCheck.code!, mfaCheck.message!);
    }

    // Rate limiting
    const rateLimit = checkRateLimit(`reconcile:${tenantId}`, 3, 300000); // 3 per 5 min
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded', 
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          } 
        }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const provider = (formData.get('provider') as string) || 'auto';
    const cycle = (formData.get('cycle') as string) || new Date().toISOString().split('T')[0];
    const amountTolerance = parseInt((formData.get('amountTolerance') as string) || '0'); // in cents
    const dateWindowDays = parseInt((formData.get('dateWindowDays') as string) || '3');

    if (!file) {
      throw new Error('No file uploaded');
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('File too large (max 10MB)');
    }

    console.log(`[Reconcile:${requestId}] File: ${file.name}, provider: ${provider}, cycle: ${cycle}`);

    // Read and parse file
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('File must contain headers and at least one data row');
    }

    // Parse CSV headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('total') || h.includes('net'));
    const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('id') || h.includes('transaction'));
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('time') || h.includes('created'));
    const feeIdx = headers.findIndex(h => h.includes('fee') || h.includes('charge'));
    const currencyIdx = headers.findIndex(h => h.includes('currency') || h.includes('curr'));

    if (amountIdx === -1) {
      throw new Error('Could not find amount column in CSV');
    }

    console.log(`[Reconcile:${requestId}] Columns - amount: ${amountIdx}, ref: ${refIdx}, date: ${dateIdx}, fee: ${feeIdx}`);

    const result: ReconciliationResult = {
      matched: 0,
      unmatched: 0,
      partialMatches: 0,
      matches: [],
      discrepancies: [],
      totalAmount: 0,
      totalFees: 0,
      requestId
    };

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim());
      
      // Parse amount (remove currency symbols and convert to cents)
      const amountStr = row[amountIdx]?.replace(/[^0-9.-]/g, '') || '0';
      const amount = Math.round(parseFloat(amountStr) * 100);
      
      const reference = refIdx !== -1 ? row[refIdx] : undefined;
      const dateStr = dateIdx !== -1 ? row[dateIdx] : undefined;
      const fee = feeIdx !== -1 ? Math.round(parseFloat(row[feeIdx]?.replace(/[^0-9.-]/g, '') || '0') * 100) : 0;
      const currency = currencyIdx !== -1 ? row[currencyIdx] : 'THB';

      result.totalAmount += amount;
      result.totalFees += fee;

      // Build matching query with fuzzy matching
      let query = supabase
        .from('payments')
        .select('id, amount, provider_payment_id, metadata, paid_at, status, currency')
        .eq('tenant_id', tenantId)
        .eq('status', 'succeeded');

      // Amount matching with tolerance
      if (amountTolerance > 0) {
        query = query
          .gte('amount', amount - amountTolerance)
          .lte('amount', amount + amountTolerance);
      } else {
        query = query.eq('amount', amount);
      }

      // Currency matching
      if (currencyIdx !== -1 && currency) {
        query = query.eq('currency', currency);
      }

      // Date window matching
      if (dateStr && dateIdx !== -1) {
        try {
          const targetDate = new Date(dateStr);
          const startDate = new Date(targetDate);
          startDate.setDate(startDate.getDate() - dateWindowDays);
          const endDate = new Date(targetDate);
          endDate.setDate(endDate.getDate() + dateWindowDays);

          query = query
            .gte('paid_at', startDate.toISOString())
            .lte('paid_at', endDate.toISOString());
        } catch (e) {
          console.warn(`[Reconcile:${requestId}] Could not parse date: ${dateStr}`);
        }
      }

      const { data: payments } = await query.limit(5);

      if (payments && payments.length > 0) {
        // Calculate match scores
        const scoredPayments = payments.map((payment: any) => {
          let score = 0;
          const reasons: string[] = [];

          // Amount match
          if (payment.amount === amount) {
            score += 50;
            reasons.push('exact_amount');
          } else {
            score += 25;
            reasons.push('amount_within_tolerance');
          }

          // Reference match
          if (reference && (
            payment.provider_payment_id === reference ||
            payment.metadata?.reference === reference
          )) {
            score += 30;
            reasons.push('reference_match');
          }

          // Date proximity
          if (dateStr && payment.paid_at) {
            const targetDate = new Date(dateStr);
            const paidDate = new Date(payment.paid_at);
            const daysDiff = Math.abs((targetDate.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 1) {
              score += 20;
              reasons.push('date_exact');
            } else if (daysDiff <= dateWindowDays) {
              score += 10;
              reasons.push('date_within_window');
            }
          }

          return { payment, score, reasons };
        });

        // Get best match
        const bestMatch = scoredPayments.sort((a, b) => b.score - a.score)[0];

        if (bestMatch.score >= 70) {
          // Strong match
          result.matched++;
          result.matches.push({
            paymentId: bestMatch.payment.id,
            statementRow: i,
            matchScore: bestMatch.score,
            matchReasons: bestMatch.reasons
          });

          // Update payment reconciliation status
          await supabase
            .from('payments')
            .update({
              reconciliation_status: 'matched',
              reconciled_at: new Date().toISOString()
            })
            .eq('id', bestMatch.payment.id);

        } else {
          // Partial match
          result.partialMatches++;
          result.discrepancies.push({
            row: i,
            amount: amount / 100,
            currency,
            reference,
            date: dateStr,
            reasons: ['partial_match_only', `best_score: ${bestMatch.score}`, ...bestMatch.reasons]
          });
        }
      } else {
        // No match found
        result.unmatched++;
        result.discrepancies.push({
          row: i,
          amount: amount / 100,
          currency,
          reference,
          date: dateStr,
          reasons: ['no_payment_found', 'check_date_window', 'verify_amount']
        });
      }
    }

    // Create settlement record
    const { data: settlement, error: settlementError } = await supabase
      .from('settlements')
      .insert({
        tenant_id: tenantId,
        provider: provider,
        cycle: cycle,
        paid_out_at: new Date().toISOString(),
        fees: result.totalFees,
        net_amount: result.totalAmount - result.totalFees
      })
      .select()
      .single();

    if (!settlementError && settlement) {
      result.settlementId = settlement.id;
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        actor_user_id: user.id,
        action: 'reconciliation.completed',
        target: `settlement:${settlement?.id || 'unknown'}`,
        after: {
          matched: result.matched,
          unmatched: result.unmatched,
          partial: result.partialMatches,
          total_amount: result.totalAmount,
          total_fees: result.totalFees,
          file_name: file.name,
          file_size: file.size,
          request_id: requestId
        },
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.substring(0, 45) || null,
        user_agent: req.headers.get('user-agent')?.substring(0, 255) || null
      });

    console.log(`[Reconcile:${requestId}] Complete: ${result.matched} matched, ${result.unmatched} unmatched, ${result.partialMatches} partial`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(`[Reconcile:${requestId}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Reconciliation failed';
    return new Response(
      JSON.stringify({ error: errorMessage, requestId }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
