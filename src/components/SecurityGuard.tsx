import { ReactNode } from "react";
import { useSecurityGuard } from "@/hooks/useSecurityGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

interface SecurityGuardProps {
  children: ReactNode;
}

export function SecurityGuard({ children }: SecurityGuardProps) {
  const { isChecking } = useSecurityGuard();

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Shield className="h-12 w-12 animate-pulse text-primary" />
              <p className="text-center text-muted-foreground">
                กำลังตรวจสอบความปลอดภัย...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}