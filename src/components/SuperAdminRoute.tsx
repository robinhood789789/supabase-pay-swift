import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface SuperAdminRouteProps {
  children: ReactNode;
}

const SuperAdminRoute = ({ children }: SuperAdminRouteProps) => {
  const { user, loading, isSuperAdmin } = useAuth();

  console.log("SuperAdminRoute - User:", user?.email);
  console.log("SuperAdminRoute - Loading:", loading);
  console.log("SuperAdminRoute - isSuperAdmin:", isSuperAdmin);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log("No user, redirecting to sign-in");
    return <Navigate to="/auth/sign-in" replace />;
  }

  if (!isSuperAdmin) {
    console.log("Not super admin, redirecting to dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default SuperAdminRoute;
