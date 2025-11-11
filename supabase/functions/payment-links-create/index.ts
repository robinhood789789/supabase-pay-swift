import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { 
  validateAmount,
  validateReference,
  validateString,
  validateFields,
  ValidationException,
  sanitizeErrorMessage
} from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { PaymentLinkRequest, PaymentLinkResponse } from '../_shared/types.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant ID from header
    const tenantId = req.headers.get('X-Tenant');
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'X-Tenant header required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SECURITY: CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) return csrfError;

    // SECURITY: Rate limiting (100 links per hour per tenant)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `payment-links:${tenantId}:${clientIp}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 100, 3600000, 0);
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 100 payment links per hour.',
          remaining: rateLimit.remaining 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateLimit.remaining)
          } 
        }
      );
    }

    // Check permission: payment_links:create
    const { data: membership } = await supabase
      .from('memberships')
      .select('role_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: permissions } = await supabase
      .from('role_permissions')
      .select('permissions(name)')
      .eq('role_id', membership.role_id);

    const hasPermission = permissions?.some(
      (p: any) => p.permissions.name === 'payment_links:create'
    );

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Missing permission: payment_links:create' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const { amount, currency, reference, expiresAt, usageLimit } = body;

    // SECURITY: Input validation
    try {
      validateFields([
        () => validateAmount(amount),
        () => validateString('currency', currency, { required: true, minLength: 3, maxLength: 3 }),
        () => reference ? validateReference(reference) : null,
      ]);
    } catch (error) {
      if (error instanceof ValidationException) {
        return new Response(
          JSON.stringify({ 
            error: 'Validation failed', 
            details: error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    if (!amount || !currency) {
      return new Response(JSON.stringify({ error: 'amount and currency are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique slug (8 characters)
    const slug = crypto.randomUUID().split('-')[0];

    // Insert payment link
    const { data: link, error: insertError } = await supabase
      .from('payment_links')
      .insert({
        tenant_id: tenantId,
        slug,
        amount,
        currency,
        reference: reference || null,
        expires_at: expiresAt || null,
        usage_limit: usageLimit || null,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating payment link:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create payment link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'payment_link.created',
      target: `payment_link:${link.id}`,
      after: link,
    });

    console.log(`Payment link created: ${slug}`);

    return new Response(JSON.stringify(link), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[INTERNAL] Error:', error);
    const errorMessage = error instanceof Error ? sanitizeErrorMessage(error) : 'An error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
