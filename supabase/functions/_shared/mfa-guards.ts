import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

interface StepUpResult {
  ok: boolean;
  code?: 'MFA_ENROLL_REQUIRED' | 'MFA_CHALLENGE_REQUIRED';
  message?: string;
}

interface RequireStepUpOptions {
  supabase: any;
  userId: string;
  tenantId?: string;
  action: 'create-payment' | 'refund' | 'api-keys' | 'webhooks' | 'roles' | 'payout' | 'approvals' | 'alerts' | 'reconciliation' | 'export-large' | 'system_deposit' | 'system_withdrawal' | 'deposit_request' | 'withdrawal_request' | 'platform.settings.update' | 'webhooks.replay';
  userRole?: string;
  isSuperAdmin?: boolean;
}

export async function requireStepUp(options: RequireStepUpOptions): Promise<StepUpResult> {
  const { supabase, userId, tenantId, action, userRole, isSuperAdmin } = options;

  console.log(`[MFA Guard] Checking step-up for user ${userId}, action: ${action}, role: ${userRole}, tenantId: ${tenantId}`);

  // Check if user is super admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_super_admin, totp_enabled, mfa_last_verified_at')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('[MFA Guard] Profile query error:', profileError);
    // Fail open if we can't fetch profile
    return { ok: true };
  }

  if (!profile) {
    console.error('[MFA Guard] Profile not found for user:', userId);
    // Fail open if profile doesn't exist
    return { ok: true };
  }

  console.log(`[MFA Guard] Profile loaded - totp_enabled: ${profile.totp_enabled}, is_super_admin: ${profile.is_super_admin}, mfa_last_verified_at: ${profile.mfa_last_verified_at}`);

  const isSuper = isSuperAdmin || profile?.is_super_admin || false;

  // Super admin always requires MFA
  if (isSuper) {
    if (!profile?.totp_enabled) {
      return {
        ok: false,
        code: 'MFA_ENROLL_REQUIRED',
        message: 'Super admin must enroll in 2FA'
      };
    }

    // Check if verification is still valid
    const lastVerified = profile.mfa_last_verified_at 
      ? new Date(profile.mfa_last_verified_at) 
      : null;
    
    if (!lastVerified) {
      return {
        ok: false,
        code: 'MFA_CHALLENGE_REQUIRED',
        message: 'MFA verification required for super admin'
      };
    }

    const now = new Date();
    const diffInSeconds = (now.getTime() - lastVerified.getTime()) / 1000;
    // Super admin: 5 minutes window for all actions
    if (diffInSeconds >= 300) {
      return {
        ok: false,
        code: 'MFA_CHALLENGE_REQUIRED',
        message: 'MFA verification expired'
      };
    }

    return { ok: true };
  }

  // For non-super admin, check tenant policy
  if (!tenantId) {
    console.log('[MFA Guard] No tenant context, allowing');
    return { ok: true }; // No tenant context, allow
  }

  const { data: policy, error: policyError } = await supabase
    .from('tenant_security_policy')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (policyError && policyError.code !== 'PGRST116') {
    console.error('[MFA Guard] Policy query error:', policyError);
  }

  // If no policy exists, don't require MFA (but create a default one)
  if (!policy) {
    console.log('[MFA Guard] No security policy found, creating default');
    // Create default policy
    await supabase
      .from('tenant_security_policy')
      .insert({
        tenant_id: tenantId,
        require_2fa_for_owner: true,
        require_2fa_for_admin: true,
        stepup_window_seconds: 300
      });
    
    // For now, don't block (policy just created)
    return { ok: true };
  }

  console.log(`[MFA Guard] Policy loaded - require_2fa_for_owner: ${policy.require_2fa_for_owner}, require_2fa_for_admin: ${policy.require_2fa_for_admin}`);

  // Check if MFA is required for this role
  let mfaRequired = false;
  if (userRole === 'owner' && policy.require_2fa_for_owner) {
    mfaRequired = true;
  } else if (userRole === 'admin' && policy.require_2fa_for_admin) {
    mfaRequired = true;
  } else if (userRole === 'manager' && policy.require_2fa_for_manager) {
    mfaRequired = true;
  } else if (userRole === 'finance' && policy.require_2fa_for_finance) {
    mfaRequired = true;
  } else if (userRole === 'developer' && policy.require_2fa_for_developer) {
    mfaRequired = true;
  }

  console.log(`[MFA Guard] MFA required for role ${userRole}: ${mfaRequired}`);

  if (!mfaRequired) {
    return { ok: true }; // MFA not required for this role
  }

  // MFA is required, check enrollment
  if (!profile?.totp_enabled) {
    console.log(`[MFA Guard] MFA required but not enrolled - totp_enabled: ${profile?.totp_enabled}`);
    return {
      ok: false,
      code: 'MFA_ENROLL_REQUIRED',
      message: 'Two-factor authentication is required for your role'
    };
  }

  console.log('[MFA Guard] TOTP is enabled, checking verification status');

  // Check if verification is still valid
  const lastVerified = profile.mfa_last_verified_at 
    ? new Date(profile.mfa_last_verified_at) 
    : null;

  if (!lastVerified) {
    console.log('[MFA Guard] No mfa_last_verified_at found, challenge required');
    return {
      ok: false,
      code: 'MFA_CHALLENGE_REQUIRED',
      message: 'MFA verification required'
    };
  }

  const now = new Date();
  const diffInSeconds = (now.getTime() - lastVerified.getTime()) / 1000;
  const stepupWindow = policy.stepup_window_seconds || 300;

  console.log(`[MFA Guard] Verification check - last verified: ${lastVerified.toISOString()}, seconds ago: ${diffInSeconds}, window: ${stepupWindow}`);

  if (diffInSeconds >= stepupWindow) {
    console.log('[MFA Guard] MFA verification expired');
    return {
      ok: false,
      code: 'MFA_CHALLENGE_REQUIRED',
      message: 'MFA verification expired'
    };
  }

  console.log('[MFA Guard] Step-up check passed');
  return { ok: true };
}

export function createMfaError(code: string, message: string) {
  // Ensure CORS headers so browser clients don't get a generic "Failed to fetch"
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant, x-csrf-token, cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  };
  return new Response(
    JSON.stringify({ error: message, code }),
    {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' }
    }
  );
}

// Simple helper to check if user has valid MFA
export async function requireMFA(userId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[MFA] Missing Supabase configuration');
    return; // Fail open if config is missing
  }
  
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=totp_enabled,mfa_last_verified_at,is_super_admin`, 
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept-Profile': 'public',
        }
      }
    );
    
    if (!response.ok) {
      console.error('[MFA] Failed to fetch profile:', response.status, response.statusText);
      return; // Fail open if we can't fetch profile
    }
    
    const data = await response.json();
    const profile = data[0];
    
    if (!profile) {
      console.warn('[MFA] Profile not found for user:', userId);
      return; // Fail open if profile doesn't exist yet
    }
    
    // Check if MFA is enabled
    if (!profile.totp_enabled) {
      if (profile.is_super_admin) {
        throw new Error('MFA_ENROLL_REQUIRED');
      }
      return; // Non-super admin without MFA is OK for now
    }
    
    // Check if MFA verification is still valid
    const lastVerified = profile.mfa_last_verified_at ? new Date(profile.mfa_last_verified_at) : null;
    if (!lastVerified) {
      throw new Error('MFA_CHALLENGE_REQUIRED');
    }
    
    const now = new Date();
    const diffInSeconds = (now.getTime() - lastVerified.getTime()) / 1000;
    
    // 5 minute window
    if (diffInSeconds >= 300) {
      throw new Error('MFA_CHALLENGE_REQUIRED');
    }
  } catch (error) {
    // If it's an MFA-related error, re-throw it
    if (error instanceof Error && (error.message === 'MFA_ENROLL_REQUIRED' || error.message === 'MFA_CHALLENGE_REQUIRED')) {
      throw error;
    }
    // Otherwise, log and fail open
    console.error('[MFA] Error checking MFA status:', error);
    return;
  }
}
