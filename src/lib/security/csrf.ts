import { supabase } from '@/integrations/supabase/client';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_COOKIE_NAME = 'csrf_token';

export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function setCSRFToken(userId: string): Promise<string> {
  const token = generateCSRFToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Clean up expired tokens
  await supabase
    .from('csrf_tokens')
    .delete()
    .lt('expires_at', new Date().toISOString());

  // Store in database
  await supabase.from('csrf_tokens').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  // Store in cookie and localStorage
  document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; secure; samesite=strict; max-age=86400`;
  localStorage.setItem(CSRF_TOKEN_KEY, token);

  return token;
}

export function getCSRFToken(): string | null {
  return localStorage.getItem(CSRF_TOKEN_KEY);
}

export function getCSRFCookie(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

export async function validateCSRFToken(token: string, userId: string): Promise<boolean> {
  // Verify double-submit cookie pattern
  const cookieToken = getCSRFCookie();
  if (cookieToken !== token) {
    return false;
  }

  // Verify against database
  const { data, error } = await supabase
    .from('csrf_tokens')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('token', token)
    .gte('expires_at', new Date().toISOString())
    .single();

  return !error && !!data;
}

export function clearCSRFToken() {
  document.cookie = `${CSRF_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  localStorage.removeItem(CSRF_TOKEN_KEY);
}
