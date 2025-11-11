/**
 * Shared CORS configuration for all Edge Functions
 * 
 * This ensures consistent CORS headers across all functions
 * and prevents configuration drift.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant, x-csrf-token, cookie',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
};

/**
 * Handle CORS preflight requests
 * 
 * Usage in your Edge Function:
 * ```typescript
 * import { corsHeaders, handleCorsPrelight } from '../_shared/cors.ts';
 * 
 * Deno.serve(async (req) => {
 *   const corsResponse = handleCorsPrelight(req);
 *   if (corsResponse) return corsResponse;
 *   
 *   // Your function logic here...
 * });
 * ```
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 * 
 * Usage:
 * ```typescript
 * return corsJsonResponse({ success: true }, 200);
 * ```
 */
export function corsJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response with CORS headers
 * 
 * Usage:
 * ```typescript
 * return corsErrorResponse('Invalid request', 400);
 * ```
 */
export function corsErrorResponse(error: string, status = 500): Response {
  return corsJsonResponse({ error }, status);
}
