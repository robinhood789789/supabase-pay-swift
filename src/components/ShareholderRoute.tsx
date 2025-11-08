import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useShareholder } from "@/hooks/useShareholder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ShareholderRouteProps {
  children: ReactNode;
}

export const ShareholderRoute = ({ children }: ShareholderRouteProps) => {
  const { isShareholder, isLoading } = useShareholder();
  const { user } = useAuth();
  const location = useLocation();
  const [checkingFirstLogin, setCheckingFirstLogin] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [requiresMFA, setRequiresMFA] = useState(false);

  useEffect(() => {
    const checkFirstLoginStatus = async () => {
      if (!user?.id) {
        setCheckingFirstLogin(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("requires_password_change, totp_enabled")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        // Check if password change is required
        if (profile?.requires_password_change) {
          setRequiresPasswordChange(true);
          setCheckingFirstLogin(false);
          return;
        }

        // Check if MFA is required but not enabled
        if (!profile?.totp_enabled) {
          setRequiresMFA(true);
          setCheckingFirstLogin(false);
          return;
        }

        setCheckingFirstLogin(false);
      } catch (err) {
        console.error("Error checking first login status:", err);
        setCheckingFirstLogin(false);
      }
    };

    if (user?.id && isShareholder) {
      checkFirstLoginStatus();
    } else {
      setCheckingFirstLogin(false);
    }
  }, [user?.id, isShareholder]);

  if (isLoading || checkingFirstLogin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isShareholder) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect to password change if required
  if (requiresPasswordChange && location.pathname !== "/first-login/change-password") {
    return <Navigate to="/first-login/change-password" replace />;
  }

  // Redirect to MFA enrollment if required
  if (requiresMFA && !requiresPasswordChange && location.pathname !== "/first-login/2fa-setup") {
    return <Navigate to="/first-login/2fa-setup" replace />;
  }

  return <>{children}</>;
};
