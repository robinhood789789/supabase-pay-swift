import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";

interface RequireTenantProps {
  children: ReactNode;
  fallbackPath?: string;
}

export const RequireTenant = ({ children, fallbackPath = "/settings" }: RequireTenantProps) => {
  const { activeTenantId, isLoading } = useTenantSwitcher();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeTenantId) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

interface TenantGuardMessageProps {
  title?: string;
  description?: string;
}

export const TenantGuardMessage = ({
  title = "No Workspace Selected",
  description = "Please create or select a workspace to continue",
}: TenantGuardMessageProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Go to Settings to create a new workspace or contact your administrator to be added to an existing one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
