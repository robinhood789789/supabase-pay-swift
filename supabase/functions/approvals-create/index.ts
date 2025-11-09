import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createApprovalRequest } from '../_shared/guardrails.ts';
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateString, sanitizeErrorMessage } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant, x-csrf-token',
};

interface ApprovalRequest {
  actionType: string;
  actionData: any;
  amount?: number;
  reason: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const tenantId = req.headers.get('x-tenant');
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing X-Tenant header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // Rate limiting: 30 approval requests per hour per user
    const rateLimitResult = checkRateLimit(user.id, 30, 3600000);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many approval requests. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ApprovalRequest = await req.json();
    const { actionType, actionData, amount, reason } = body;

    // Input validation
    const validationErrors = [];
    
    const typeError = validateString('actionType', actionType, { 
      required: true, 
      maxLength: 50,
      pattern: /^[a-z_]+$/,
      patternMessage: 'Action type must be lowercase letters and underscores only'
    });
    if (typeError) validationErrors.push(typeError);
    
    if (!actionData || typeof actionData !== 'object') {
      validationErrors.push({ field: 'actionData', message: 'Action data must be an object' });
    }
    
    if (amount !== undefined) {
      if (typeof amount !== 'number' || amount <= 0) {
        validationErrors.push({ field: 'amount', message: 'Amount must be a positive number' });
      }
    }
    
    if (reason) {
      const reasonError = validateString('reason', reason, { maxLength: 1000 });
      if (reasonError) validationErrors.push(reasonError);
    }

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: validationErrors.map(e => e.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!actionType || !actionData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await createApprovalRequest(supabase, {
      tenantId,
      requestedBy: user.id,
      actionType,
      actionData,
      amount,
      reason: reason || 'Approval required by guardrail',
    });

    if ('error' in result) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Approval] Created: ${result.approvalId} for ${actionType}`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Approval Create] Error:', error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorMessage(error as Error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
