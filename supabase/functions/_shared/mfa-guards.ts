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

  console.log(`[MFA Guard] Checking step-up for user ${userId}, action: ${action}`);

  // Check if user is super admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin, totp_enabled, mfa_last_verified_at')
    .eq('id', userId)
    .single();

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
    return { ok: true }; // No tenant context, allow
  }

  const { data: policy } = await supabase
    .from('tenant_security_policy')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  // If no policy exists, don't require MFA (but create a default one)
  if (!policy) {
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

  if (!mfaRequired) {
    return { ok: true }; // MFA not required for this role
  }

  // MFA is required, check enrollment
  if (!profile?.totp_enabled) {
    return {
      ok: false,
      code: 'MFA_ENROLL_REQUIRED',
      message: 'Two-factor authentication is required for your role'
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
      message: 'MFA verification required'
    };
  }

  const now = new Date();
  const diffInSeconds = (now.getTime() - lastVerified.getTime()) / 1000;
  const stepupWindow = policy.stepup_window_seconds || 300;

  if (diffInSeconds >= stepupWindow) {
    return {
      ok: false,
      code: 'MFA_CHALLENGE_REQUIRED',
      message: 'MFA verification expired'
    };
  }

  return { ok: true };
}

export function createMfaError(code: string, message: string) {
  return new Response(
    JSON.stringify({ error: message, code }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
