import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export function useSecurityGuard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  // Fetch security requirements
  const { data: securityStatus, isLoading: securityLoading } = useQuery({
    queryKey: ['security-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('totp_enabled, requires_password_change')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching security status:', error);
        return null;
      }

      return profile;
    },
    enabled: !!user?.id && !authLoading,
  });

  useEffect(() => {
    // Skip if loading or no user
    if (authLoading || securityLoading || !user) {
      setIsChecking(authLoading || securityLoading);
      return;
    }

    // Skip security checks on auth pages
    const authPages = ['/auth', '/auth/mfa-enroll', '/auth/password-change', '/auth/mfa-challenge'];
    if (authPages.some(page => location.pathname.startsWith(page))) {
      setIsChecking(false);
      return;
    }

    const checkSecurityRequirements = () => {
      if (!securityStatus) {
        setIsChecking(false);
        return;
      }

      // Check MFA enrollment (required for ALL users)
      if (!securityStatus.totp_enabled) {
        console.log('[Security Guard] MFA not enrolled, redirecting to enrollment');
        navigate('/auth/mfa-enroll', { 
          state: { returnTo: location.pathname },
          replace: true 
        });
        return;
      }

      // Check password change requirement
      if (securityStatus.requires_password_change) {
        console.log('[Security Guard] Password change required, redirecting');
        navigate('/auth/password-change', { 
          state: { returnTo: location.pathname },
          replace: true 
        });
        return;
      }

      setIsChecking(false);
    };

    checkSecurityRequirements();
  }, [user, authLoading, securityLoading, securityStatus, location.pathname, navigate]);

  return {
    isChecking: authLoading || securityLoading || isChecking,
    securityStatus,
  };
}