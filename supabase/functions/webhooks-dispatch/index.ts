import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { handleEnhancedError, ValidationError, AuthenticationError } from '../_shared/enhanced-errors.ts';
import { dispatchWebhookEvent } from '../_shared/webhook-dispatcher.ts';

const logger = createLogger('webhooks-dispatch');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  logger.setContext({ requestId, ...extractRequestContext(req) });
  logger.logRequest(req);

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AuthenticationError('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new AuthenticationError('Invalid authentication token');
    }

    logger.setContext({ userId: user.id });

    // Get user's tenant
    const { data: membership, error: membershipError } = await supabaseClient
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      throw new ValidationError('User is not associated with any tenant');
    }

    const tenantId = membership.tenant_id;
    logger.setContext({ tenantId });

    // Parse request body
    const body = await req.json();
    const { event_type, data, metadata } = body;

    if (!event_type || typeof event_type !== 'string') {
      throw new ValidationError('event_type is required and must be a string');
    }

    if (!data || typeof data !== 'object') {
      throw new ValidationError('data is required and must be an object');
    }

    logger.info('Dispatching webhook event', {
      event_type,
      has_metadata: !!metadata,
    });

    // Dispatch webhook event
    const results = await dispatchWebhookEvent(
      supabaseClient,
      tenantId,
      event_type,
      data,
      metadata
    );

    const response = {
      success: true,
      dispatched: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results: results.map((r) => ({
        webhook_id: r.webhook_id,
        success: r.success,
        status: r.response_status,
      })),
    };

    logger.logResponse(200, response);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return handleEnhancedError(error, logger);
  }
});
