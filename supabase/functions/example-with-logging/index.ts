/**
 * Example Edge Function with Enhanced Logging
 * 
 * This is a template showing best practices for:
 * - Structured logging
 * - Error handling
 * - Request/response tracking
 * - Context management
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  handleEnhancedError,
} from '../_shared/enhanced-errors.ts';

serve(async (req) => {
  // 1. Initialize logger with function name
  const logger = createLogger('example-with-logging');
  
  // 2. Handle CORS preflight
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    // 3. Log incoming request
    logger.logRequest(req);
    
    // 4. Extract and set request context
    const requestContext = extractRequestContext(req);
    logger.setContext(requestContext);
    logger.info('Request received');

    // 5. Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.warn('Missing authorization header');
      throw new AuthenticationError('Authorization required');
    }

    // 6. Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 7. Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error('Authentication failed', authError);
      throw new AuthenticationError('Invalid credentials');
    }

    // 8. Add user context
    logger.setContext({ userId: user.id });
    logger.info('User authenticated', { 
      email: user.email,
      authProvider: user.app_metadata?.provider 
    });

    // 9. Get tenant context
    const tenantId = req.headers.get('x-tenant');
    if (tenantId) {
      logger.setContext({ tenantId });
      logger.debug('Tenant context set', { tenantId });
    }

    // 10. Parse request body
    const body = await req.json();
    logger.debug('Request body parsed', { 
      bodyKeys: Object.keys(body),
      bodySize: JSON.stringify(body).length 
    });

    // 11. Validate input
    if (!body.name || typeof body.name !== 'string') {
      throw new ValidationError('Name must be a non-empty string', {
        field: 'name',
        received: body.name,
        expectedType: 'string',
      });
    }

    if (body.name.length > 100) {
      throw new ValidationError('Name too long', {
        field: 'name',
        maxLength: 100,
        actualLength: body.name.length,
      });
    }

    logger.info('Input validated', { name: body.name });

    // 12. Business logic with detailed logging
    logger.info('Starting database operation', { 
      operation: 'insert',
      table: 'examples' 
    });

    const { data: item, error: insertError } = await supabase
      .from('examples')
      .insert({
        name: body.name,
        user_id: user.id,
        tenant_id: tenantId || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Database insert failed', insertError, {
        table: 'examples',
        operation: 'insert',
        postgresCode: insertError.code,
      });
      throw new DatabaseError('Failed to create item', {
        operation: 'insert',
        table: 'examples',
      });
    }

    if (!item) {
      logger.error('Insert succeeded but no data returned');
      throw new NotFoundError('Created item');
    }

    logger.info('Item created successfully', {
      itemId: item.id,
      itemName: item.name,
    });

    // 13. Additional operations example
    logger.debug('Checking for related items');
    
    const { data: relatedItems, error: queryError } = await supabase
      .from('examples')
      .select('id, name')
      .eq('user_id', user.id)
      .limit(10);

    if (queryError) {
      logger.warn('Failed to fetch related items', queryError);
      // Non-critical error, continue
    } else {
      logger.info('Related items fetched', { 
        count: relatedItems?.length || 0 
      });
    }

    // 14. Prepare response
    const response = {
      success: true,
      item: {
        id: item.id,
        name: item.name,
        created_at: item.created_at,
      },
      meta: {
        duration: logger.getDuration(),
        relatedCount: relatedItems?.length || 0,
      },
    };

    // 15. Log response
    logger.logResponse(200, response);
    logger.info('Request completed successfully', {
      duration: logger.getDuration(),
      itemId: item.id,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // 16. Central error handling
    // This will:
    // - Log the error with full context
    // - Return appropriate HTTP response
    // - Include error metadata
    return handleEnhancedError(error, logger);
  }
});
