import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface MfaGuardOptions {
  required?: boolean;
  redirectTo?: string;
}

export function useMfaGuard(options: MfaGuardOptions = {}) {
  const { required = true, redirectTo = '/dashboard' } = options;
  const { user, userRole, tenantId, isSuperAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Fetch user profile and tenant policy
  const { data: securityData, isLoading: securityLoading } = useQuery({
    queryKey: ['mfa-guard', user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('totp_enabled, mfa_last_verified_at')
        .eq('id', user.id)
        .single();

      // Get tenant security policy if user has a tenant
      let tenantPolicy = null;
      if (tenantId) {
        const { data: policy } = await supabase
          .from('tenant_security_policy')
          .select('*')
          .eq('tenant_id', tenantId)
          .single();
        tenantPolicy = policy;
      }

      return { profile, tenantPolicy };
    },
    enabled: !!user?.id && !authLoading,
  });

  useEffect(() => {
    if (authLoading || securityLoading || !user) return;
    if (!required) return;

    const checkMfaRequirement = () => {
      const profile = securityData?.profile;
      const tenantPolicy = securityData?.tenantPolicy;

      // Check if MFA is required based on role and policy
      let mfaRequired = false;

      if (isSuperAdmin) {
        // Super admin always requires MFA
        mfaRequired = true;
      } else if (tenantPolicy && tenantId) {
        // Check tenant policy
        if (userRole === 'owner' && tenantPolicy.require_2fa_for_owner) {
          mfaRequired = true;
        } else if (userRole === 'finance' && tenantPolicy.require_2fa_for_finance) {
          mfaRequired = true;
        }
      }

      if (!mfaRequired) return;

      // If MFA is required but not enabled, redirect to settings
      if (!profile?.totp_enabled) {
        navigate('/settings', { 
          state: { 
            tab: 'security',
            message: 'Please enable Two-Factor Authentication to continue. It is required for your role.' 
          },
          replace: true
        });
        return;
      }

      // If MFA is enabled, check if verification is still valid
      const lastVerified = profile.mfa_last_verified_at 
        ? new Date(profile.mfa_last_verified_at) 
        : null;
      const now = new Date();
      const stepupWindow = tenantPolicy?.stepup_window_seconds || 300;

      if (!lastVerified) {
        // Never verified, need to verify now
        navigate('/auth/mfa-challenge', { 
          state: { returnTo: redirectTo },
          replace: true
        });
        return;
      }

      const diffInSeconds = (now.getTime() - lastVerified.getTime()) / 1000;
      if (diffInSeconds >= stepupWindow) {
        // Verification expired, need to re-verify
        navigate('/auth/mfa-challenge', { 
          state: { returnTo: redirectTo },
          replace: true
        });
      }
    };

    checkMfaRequirement();
  }, [
    user,
    userRole,
    tenantId,
    isSuperAdmin,
    authLoading,
    securityLoading,
    securityData,
    required,
    redirectTo,
    navigate,
  ]);

  return {
    isLoading: authLoading || securityLoading,
    securityData,
  };
}
