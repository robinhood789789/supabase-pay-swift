import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { handleEnhancedError, ValidationError, AuthenticationError, AuthorizationError } from '../_shared/enhanced-errors.ts';
import { retryWebhookDelivery } from '../_shared/webhook-dispatcher.ts';

const logger = createLogger('webhooks-retry');

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
    const { webhook_event_id } = body;

    if (!webhook_event_id || typeof webhook_event_id !== 'string') {
      throw new ValidationError('webhook_event_id is required and must be a string');
    }

    logger.info('Retrying webhook delivery', { webhook_event_id });

    // Verify webhook event belongs to user's tenant
    const { data: event, error: eventError } = await supabaseClient
      .from('webhook_events')
      .select('tenant_id')
      .eq('id', webhook_event_id)
      .single();

    if (eventError || !event) {
      throw new ValidationError('Webhook event not found');
    }

    if (event.tenant_id !== tenantId) {
      throw new AuthorizationError('Not authorized to retry this webhook');
    }

    // Retry webhook delivery
    const result = await retryWebhookDelivery(supabaseClient, webhook_event_id);

    const response = {
      success: true,
      webhook_event_id,
      delivery_success: result.success,
      response_status: result.response_status,
      error_message: result.error_message,
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
