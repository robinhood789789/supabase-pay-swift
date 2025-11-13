import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
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
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { handleEnhancedError, ValidationError, AuthenticationError, AuthorizationError } from '../_shared/enhanced-errors.ts';

serve(async (req) => {
  const logger = createLogger('payment-links-create');
  
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    logger.logRequest(req);
    const requestContext = extractRequestContext(req);
    logger.setContext(requestContext);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant ID from header
    const tenantId = req.headers.get('X-Tenant');
    if (!tenantId) {
      throw new ValidationError('X-Tenant header required');
    }

    logger.setContext({ tenantId });
    logger.info('Processing payment link creation', { tenantId });

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AuthenticationError('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message });
      throw new AuthenticationError('Invalid authentication token');
    }

    logger.setContext({ userId: user.id });
    logger.info('User authenticated', { email: user.email });

    // SECURITY: CSRF validation
    const csrfError = await requireCSRF(req, user.id);
    if (csrfError) {
      logger.warn('CSRF validation failed', { userId: user.id });
      return csrfError;
    }

    // SECURITY: Rate limiting (100 links per hour per tenant)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `payment-links:${tenantId}:${clientIp}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 100, 3600000, 0);
    
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { 
        rateLimitKey, 
        remaining: rateLimit.remaining,
        ip: clientIp 
      });
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

    logger.debug('Rate limit check passed', { remaining: rateLimit.remaining });

    // Check permission: payment_links:create
    const { data: membership } = await supabase
      .from('memberships')
      .select('role_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership) {
      logger.warn('User not member of tenant', { userId: user.id, tenantId });
      throw new AuthorizationError('Not a member of this tenant');
    }

    const { data: permissions } = await supabase
      .from('role_permissions')
      .select('permissions(name)')
      .eq('role_id', membership.role_id);

    const hasPermission = permissions?.some(
      (p: any) => p.permissions.name === 'payment_links:create'
    );

    if (!hasPermission) {
      logger.warn('Missing permission', { 
        userId: user.id, 
        roleId: membership.role_id,
        requiredPermission: 'payment_links:create'
      });
      throw new AuthorizationError('Missing permission: payment_links:create');
    }

    logger.info('Permission check passed', { permission: 'payment_links:create' });

    // Parse request body
    const body = await req.json();
    const { amount, currency, reference, expiresAt, usageLimit } = body;

    // SECURITY: Input validation
    logger.debug('Validating request body', { 
      hasAmount: !!amount, 
      hasCurrency: !!currency,
      hasReference: !!reference 
    });

    try {
      validateFields([
        () => validateAmount(amount),
        () => validateString('currency', currency, { required: true, minLength: 3, maxLength: 3 }),
        () => reference ? validateReference(reference) : null,
      ]);
    } catch (error) {
      if (error instanceof ValidationException) {
        logger.warn('Validation failed', { errors: error.errors });
        throw new ValidationError('Validation failed', { errors: error.errors });
      }
      throw error;
    }

    if (!amount || !currency) {
      logger.warn('Missing required fields', { hasAmount: !!amount, hasCurrency: !!currency });
      throw new ValidationError('amount and currency are required');
    }

    logger.info('Input validation passed');

    // Generate unique slug (8 characters)
    const slug = crypto.randomUUID().split('-')[0];
    logger.debug('Generated payment link slug', { slug });

    // Insert payment link
    logger.info('Creating payment link in database', { 
      slug, 
      amount, 
      currency,
      hasReference: !!reference,
      hasExpiresAt: !!expiresAt,
      hasUsageLimit: !!usageLimit
    });

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
      logger.error('Database insert failed', insertError, { slug });
      throw new Error('Failed to create payment link');
    }

    logger.info('Payment link created successfully', { 
      linkId: link.id, 
      slug,
      amount,
      currency
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'payment_link.created',
      target: `payment_link:${link.id}`,
      after: link,
    });

    logger.info('Audit log created');
    logger.logResponse(201, link);

    return new Response(JSON.stringify(link), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
