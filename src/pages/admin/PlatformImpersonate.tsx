import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, UserCheck, UserX, Search } from "lucide-react";
import { toast } from "sonner";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

const PlatformImpersonate = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [impersonateStartedAt, setImpersonateStartedAt] = useState<Date | null>(null);
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});

  useEffect(() => {
    if (!user || !isSuperAdmin) return;

    // Audit: Page view
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "platform.impersonate.view",
      target_type: "platform_impersonate",
      ip_address: "",
      user_agent: navigator.userAgent,
    });

    loadTenants();
  }, [user, isSuperAdmin]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error("Error loading tenants:", error);
      toast.error("ไม่สามารถโหลด tenants ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleStartImpersonate = async (tenantId: string, tenantName: string) => {
    const action = async () => {
      try {
        // Audit: Start impersonation
        await supabase.from("audit_logs").insert({
          actor_id: user!.id,
          action: "platform.impersonate.start",
          target_type: "tenant",
          target_id: tenantId,
          before_state: { impersonating: null },
          after_state: { impersonating: tenantId, tenant_name: tenantName },
          ip_address: "",
          user_agent: navigator.userAgent,
        });

        setImpersonating(tenantId);
        setImpersonateStartedAt(new Date());
        localStorage.setItem("impersonate_tenant_id", tenantId);
        localStorage.setItem("impersonate_started_at", new Date().toISOString());

        toast.success(`เริ่ม impersonate ${tenantName} สำเร็จ (Read-Only)`);
      } catch (error) {
        console.error("Error starting impersonation:", error);
        toast.error("ไม่สามารถเริ่ม impersonate ได้");
      }
    };

    setPendingAction(() => action);
    await checkAndChallenge(action);
  };

  const handleStopImpersonate = async () => {
    const action = async () => {
      try {
        // Audit: Stop impersonation
        await supabase.from("audit_logs").insert({
          actor_id: user!.id,
          action: "platform.impersonate.stop",
          target_type: "tenant",
          target_id: impersonating,
          before_state: { impersonating },
          after_state: { impersonating: null },
          ip_address: "",
          user_agent: navigator.userAgent,
        });

        setImpersonating(null);
        setImpersonateStartedAt(null);
        localStorage.removeItem("impersonate_tenant_id");
        localStorage.removeItem("impersonate_started_at");

        toast.success("หยุด impersonate สำเร็จ");
      } catch (error) {
        console.error("Error stopping impersonation:", error);
        toast.error("ไม่สามารถหยุด impersonate ได้");
      }
    };

    setPendingAction(() => action);
    await checkAndChallenge(action);
  };

  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTimeRemaining = () => {
    if (!impersonateStartedAt) return null;
    const maxDuration = 30 * 60 * 1000; // 30 minutes
    const elapsed = Date.now() - impersonateStartedAt.getTime();
    const remaining = maxDuration - elapsed;
    if (remaining <= 0) {
      handleStopImpersonate();
      return null;
    }
    return Math.floor(remaining / 60000); // minutes
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Impersonate Tenant (View-As)</h1>
          <p className="text-muted-foreground">
            ดูข้อมูลในมุมมองของ tenant (Read-Only Mode เท่านั้น)
          </p>
        </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          ⚠️ การเริ่มและหยุด impersonation ต้องการ MFA ทุกครั้ง | ⏱️ Max 30 นาที | 📖 Read-Only เท่านั้น
        </AlertDescription>
      </Alert>

      {impersonating && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <UserCheck className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            🔍 กำลัง impersonate:{" "}
            <strong>{tenants.find((t) => t.id === impersonating)?.name}</strong> | เวลาที่เหลือ:{" "}
            <strong>{getTimeRemaining()} นาที</strong>
            <Button
              variant="destructive"
              size="sm"
              className="ml-4"
              onClick={handleStopImpersonate}
            >
              <UserX className="h-4 w-4 mr-2" />
              หยุด Impersonate
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ค้นหา Tenant</CardTitle>
          <CardDescription>เลือก tenant ที่ต้องการ impersonate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>ค้นหาชื่อ Tenant</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ tenant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenants ({filteredTenants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    ไม่พบ tenants
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-mono text-sm">{tenant.id}</TableCell>
                    <TableCell>{tenant.name}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(tenant.created_at).toLocaleDateString("th-TH")}</TableCell>
                    <TableCell>
                      {impersonating === tenant.id ? (
                        <Badge variant="secondary">กำลัง Impersonate</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartImpersonate(tenant.id, tenant.name)}
                          disabled={!!impersonating}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Impersonate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TwoFactorChallenge
        open={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={() => {
          onSuccess();
          if (pendingAction) pendingAction();
        }}
      />
      </div>
  );
};

export default PlatformImpersonate;
