import { supabase } from "@/integrations/supabase/client";
import { getCSRFToken } from "@/lib/security/csrf";

const ACTIVE_TENANT_KEY = "active_tenant_id";

/**
 * Wrapper for supabase.functions.invoke that automatically adds X-Tenant header,
 * Authorization bearer token, and CSRF token for security.
 */
export const invokeFunctionWithTenant = async <T = any>(
  functionName: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
    throwOnError?: boolean;
  }
): Promise<{ data: T | null; error: any }> => {
  // Resolve active tenant from localStorage (supports generic and per-user keys)
  let activeTenantId: string | null = null;
  try {
    // Try generic key first (backward compatible)
    activeTenantId = localStorage.getItem(ACTIVE_TENANT_KEY);
    // Fallback: search any user-scoped key like `active_tenant_id:<userId>`
    if (!activeTenantId) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${ACTIVE_TENANT_KEY}:`)) {
          const val = localStorage.getItem(key);
          if (val) { activeTenantId = val; break; }
        }
      }
    }
  } catch {}

  // Get current session and explicitly pass Authorization header
  // because supabase.functions.invoke doesn't always include it automatically
  const { data: { session } } = await supabase.auth.getSession();
  
  // Get CSRF token for authenticated requests
  const csrfToken = getCSRFToken();
  
  const headers = {
    ...(options?.headers || {}),
    ...(activeTenantId ? { "x-tenant": activeTenantId } : {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
  } as Record<string, string>;

  const resp = await supabase.functions.invoke(functionName, {
    ...options,
    headers,
  });

  if ((resp as any)?.error) {
    let serverMsg = 'Edge function error';
    let serverCode: string | undefined;
    try {
      const ctx: any = (resp as any).error?.context;
      if (ctx && typeof ctx.text === 'function') {
        const txt = await ctx.text();
        try {
          const json = JSON.parse(txt);
          serverMsg = json?.error || json?.message || serverMsg;
          serverCode = json?.code;
        } catch {
          serverMsg = txt || serverMsg;
        }
      }
    } catch {}

    if (options?.throwOnError) {
      const err: any = new Error(serverMsg);
      if (serverCode) err.code = serverCode;
      err.cause = (resp as any).error;
      throw err;
    }

    return { data: null, error: { message: serverMsg, code: serverCode, raw: (resp as any).error } } as any;
  }

  return { data: (resp as any).data, error: null } as any;
};
