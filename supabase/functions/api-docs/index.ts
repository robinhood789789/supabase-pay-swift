import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has owner or developer role
    const { data: membership } = await supabaseClient
      .from('memberships')
      .select('role_id, roles(name)')
      .eq('user_id', user.id)
      .single();

    const roleName = (membership as any)?.roles?.name;
    if (!roleName || !['owner', 'developer'].includes(roleName)) {
      return new Response(JSON.stringify({ error: 'Forbidden - requires owner or developer role' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'openapi';

    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Payment Platform API',
        version: '1.0.0',
        description: 'Complete API documentation for the Payment Platform',
        contact: {
          name: 'API Support',
          email: 'support@paymentplatform.com',
        },
      },
      servers: [
        {
          url: `${Deno.env.get('SUPABASE_URL')}/functions/v1`,
          description: 'Production server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
        schemas: {
          Payment: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              amount: { type: 'integer', description: 'Amount in cents' },
              currency: { type: 'string', example: 'THB' },
              status: { type: 'string', enum: ['pending', 'succeeded', 'failed'] },
              method: { type: 'string', example: 'card' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          PaymentLink: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              slug: { type: 'string' },
              amount: { type: 'integer' },
              currency: { type: 'string' },
              status: { type: 'string' },
              expires_at: { type: 'string', format: 'date-time' },
            },
          },
          CheckoutSession: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              amount: { type: 'integer' },
              currency: { type: 'string' },
              redirect_url: { type: 'string' },
              qr_image_url: { type: 'string' },
            },
          },
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
      security: [
        { bearerAuth: [] },
        { apiKey: [] },
      ],
      paths: {
        '/checkout-sessions-create': {
          post: {
            summary: 'Create checkout session',
            description: 'Create a new checkout session for payment processing',
            tags: ['Checkout'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['amount', 'currency', 'methodTypes'],
                    properties: {
                      amount: { type: 'integer', example: 10000 },
                      currency: { type: 'string', example: 'THB' },
                      methodTypes: { type: 'array', items: { type: 'string' }, example: ['card', 'promptpay'] },
                      reference: { type: 'string' },
                      metadata: { type: 'object' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Checkout session created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CheckoutSession' },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
              '500': { description: 'Internal server error' },
            },
          },
        },
        '/payment-links-create': {
          post: {
            summary: 'Create payment link',
            description: 'Create a shareable payment link',
            tags: ['Payment Links'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['amount', 'currency'],
                    properties: {
                      amount: { type: 'integer', example: 5000 },
                      currency: { type: 'string', example: 'THB' },
                      reference: { type: 'string' },
                      expires_at: { type: 'string', format: 'date-time' },
                      usage_limit: { type: 'integer' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Payment link created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/PaymentLink' },
                  },
                },
              },
            },
          },
        },
        '/payment-links-get/{slug}': {
          get: {
            summary: 'Get payment link',
            description: 'Retrieve payment link details by slug',
            tags: ['Payment Links'],
            parameters: [
              {
                name: 'slug',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Payment link details',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/PaymentLink' },
                  },
                },
              },
              '404': { description: 'Payment link not found' },
            },
          },
        },
        '/refunds-create': {
          post: {
            summary: 'Create refund',
            description: 'Issue a refund for a payment',
            tags: ['Refunds'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['payment_id', 'amount'],
                    properties: {
                      payment_id: { type: 'string', format: 'uuid' },
                      amount: { type: 'integer' },
                      reason: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Refund created' },
              '400': { description: 'Invalid request' },
            },
          },
        },
        '/payments-export': {
          post: {
            summary: 'Export payments',
            description: 'Export payment data as CSV',
            tags: ['Payments'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      start_date: { type: 'string', format: 'date' },
                      end_date: { type: 'string', format: 'date' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'CSV export',
                content: {
                  'text/csv': {
                    schema: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        '/api-keys-create': {
          post: {
            summary: 'Create API key',
            description: 'Generate a new API key for authentication',
            tags: ['API Keys'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                      name: { type: 'string', example: 'Production API Key' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'API key created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        key: { type: 'string' },
                        prefix: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/api-keys-revoke': {
          post: {
            summary: 'Revoke API key',
            description: 'Revoke an existing API key',
            tags: ['API Keys'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['key_id'],
                    properties: {
                      key_id: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'API key revoked' },
            },
          },
        },
        '/health': {
          get: {
            summary: 'Health check',
            description: 'Check API health status',
            tags: ['System'],
            security: [],
            responses: {
              '200': {
                description: 'Healthy',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'healthy' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    if (format === 'postman') {
      const postmanCollection = {
        info: {
          name: 'Payment Platform API',
          description: 'Postman collection for Payment Platform API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        auth: {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{jwt_token}}',
              type: 'string',
            },
          ],
        },
        variable: [
          {
            key: 'base_url',
            value: `${Deno.env.get('SUPABASE_URL')}/functions/v1`,
          },
        ],
        item: Object.entries(openApiSpec.paths).map(([path, methods]: [string, any]) => {
          const items = Object.entries(methods).map(([method, spec]: [string, any]) => ({
            name: spec.summary,
            request: {
              method: method.toUpperCase(),
              header: [
                { key: 'Content-Type', value: 'application/json' },
              ],
              url: {
                raw: `{{base_url}}${path}`,
                host: ['{{base_url}}'],
                path: path.split('/').filter(Boolean),
              },
              body: spec.requestBody ? {
                mode: 'raw',
                raw: JSON.stringify(spec.requestBody.content['application/json'].schema.properties, null, 2),
              } : undefined,
            },
          }));
          return {
            name: path,
            item: items,
          };
        }),
      };

      return new Response(JSON.stringify(postmanCollection, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="payment-platform-api.postman_collection.json"',
        },
      });
    }

    return new Response(JSON.stringify(openApiSpec, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-docs function:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
