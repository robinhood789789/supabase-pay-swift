import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook to enforce MFA verification after login based on role and policy
 * Redirects to /auth/mfa-challenge if MFA is required but not verified
 */
export function useMfaLoginGuard() {
  const { user, isSuperAdmin, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    
    // Skip if already on MFA pages
    if (location.pathname.includes('/mfa-challenge') || 
        location.pathname.includes('/auth/mfa-enroll') ||
        location.pathname.includes('/settings')) {
      return;
    }

    const checkMfaRequirement = async () => {
      try {
        // Get user profile with MFA status
        const { data: profile } = await supabase
          .from('profiles')
          .select('totp_enabled')
          .eq('id', user.id)
          .single();

        if (!profile) return;

        // Super Admin ALWAYS requires MFA
        if (isSuperAdmin) {
          if (!profile.totp_enabled) {
            console.log('[MFA Guard] Super Admin must enroll in 2FA');
            navigate('/settings?tab=security', { 
              state: { 
                message: 'Super Admin ต้องเปิดใช้งาน 2FA ก่อนเข้าใช้ระบบ',
                tab: 'security'
              } 
            });
            return;
          }

          // Super Admin with MFA enabled can proceed
          // (stepup verification removed - column doesn't exist)
        }

        // For non-super admin, check tenant policy
        if (userRole === 'owner' || userRole === 'finance' || userRole === 'manager') {
          const { data: membership } = await supabase
            .from('memberships')
            .select('tenant_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!membership?.tenant_id) return;

          // Get tenant security policy
          const { data: policy } = await supabase
            .from('tenant_security_policy')
            .select('*')
            .eq('tenant_id', membership.tenant_id)
            .single();

          if (!policy) return; // No policy, allow access

          // Check if MFA is required for this role
          let mfaRequired = false;
          if (userRole === 'owner' && policy.require_2fa_for_owner) {
            mfaRequired = true;
          } else if (userRole === 'finance' && policy.require_2fa_for_finance) {
            mfaRequired = true;
          } else if (userRole === 'manager' && policy.require_2fa_for_manager) {
            mfaRequired = true;
          }

          if (!mfaRequired) return; // MFA not required for this role

          // MFA is required - check enrollment
          if (!profile.totp_enabled) {
            console.log(`[MFA Guard] ${userRole} must enroll in 2FA per tenant policy`);
            navigate('/settings?tab=security', { 
              state: { 
                message: `บัญชี ${userRole} ต้องเปิดใช้งาน 2FA ตามนโยบายขององค์กร`,
                tab: 'security'
              } 
            });
            return;
          }

          // User with MFA enabled can proceed
          // (stepup verification removed - column doesn't exist)
        }
      } catch (error) {
        console.error('[MFA Guard] Error checking MFA requirement:', error);
      }
    };

    // Small delay to ensure auth state is settled
    const timer = setTimeout(checkMfaRequirement, 500);
    return () => clearTimeout(timer);
  }, [user, isSuperAdmin, userRole, loading, navigate, location.pathname]);
}
