import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import { CheckCircle2, XCircle } from "lucide-react";

const AuthStatus = () => {
  const { user, isSuperAdmin, userRole, tenantId, tenantName } = useAuth();

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Authentication Status Test</h1>
          <p className="text-muted-foreground">ตรวจสอบสถานะการ Login และ Permissions</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Email:</span>
                <span className="text-muted-foreground">{user?.email || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">User ID:</span>
                <span className="text-xs text-muted-foreground">{user?.id || "N/A"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Role Info */}
          <Card>
            <CardHeader>
              <CardTitle>Role & Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">User Role:</span>
                <Badge variant="outline">{userRole || "N/A"}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Is Super Admin:</span>
                {isSuperAdmin ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tenant Info */}
          <Card>
            <CardHeader>
              <CardTitle>Tenant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Tenant Name:</span>
                <span className="text-muted-foreground">{tenantName || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Tenant ID:</span>
                <span className="text-xs text-muted-foreground">{tenantId || "N/A"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Access Control */}
          <Card>
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Can see Super Admin menu:</span>
                {isSuperAdmin ? (
                  <Badge variant="default" className="bg-red-600">Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Can see System Deposit:</span>
                {!isSuperAdmin && userRole === "owner" ? (
                  <Badge variant="default" className="bg-green-600">Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Can manage tenants:</span>
                {isSuperAdmin ? (
                  <Badge variant="default" className="bg-red-600">Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debug Info */}
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="text-yellow-600">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto p-4 bg-muted rounded">
{JSON.stringify({
  user: {
    id: user?.id,
    email: user?.email,
  },
  isSuperAdmin,
  userRole,
  tenantId,
  tenantName,
  timestamp: new Date().toISOString(),
}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AuthStatus;
