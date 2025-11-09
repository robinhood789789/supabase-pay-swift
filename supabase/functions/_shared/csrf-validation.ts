// CSRF validation utilities for edge functions
// ข้อ 2: CSRF protection implemented but never enforced

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function validateCSRFToken(
  req: Request,
  userId: string
): Promise<{ valid: boolean; reason?: string }> {
  // Get CSRF token from header
  const csrfToken = req.headers.get('x-csrf-token');
  
  if (!csrfToken) {
    return { valid: false, reason: 'CSRF token required' };
  }
  
  // Get CSRF token from cookie (double-submit cookie pattern)
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const csrfCookie = cookies.find(c => c.startsWith('csrf_token='));
  const cookieToken = csrfCookie?.split('=')[1];
  
  // Verify double-submit pattern
  if (cookieToken !== csrfToken) {
    return { valid: false, reason: 'CSRF token mismatch' };
  }
  
  // Verify against database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  const { data, error } = await supabase
    .from('csrf_tokens')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('token', csrfToken)
    .gte('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) {
    return { valid: false, reason: 'Invalid or expired CSRF token' };
  }
  
  return { valid: true };
}

// Middleware to validate CSRF token
export async function requireCSRF(req: Request, userId: string): Promise<Response | null> {
  const result = await validateCSRFToken(req, userId);
  
  if (!result.valid) {
    return new Response(
      JSON.stringify({ error: result.reason || 'CSRF validation failed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  return null;
}
