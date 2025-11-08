import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, AlertCircle, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Dispute {
  id: string;
  payment_id: string;
  tenant_id: string;
  tenant_name: string;
  amount: number;
  currency: string;
  reason: string;
  status: "pending" | "under_review" | "won" | "lost";
  created_at: string;
  due_by?: string;
}

const PlatformDisputes = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user || !isSuperAdmin) return;

    // Audit: Page view
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "platform.disputes.view",
      target_type: "platform_disputes",
      ip_address: "",
      user_agent: navigator.userAgent,
    });

    loadDisputes();
  }, [user, isSuperAdmin]);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      // Cross-tenant query - Super Admin can see all
      const { data, error } = await supabase
        .from("disputes")
        .select(`
          id,
          payment_id,
          tenant_id,
          tenants!inner(name),
          amount,
          currency,
          reason,
          status,
          stage,
          due_at,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const transformedDisputes = data?.map((d: any) => ({
        id: d.id,
        payment_id: d.payment_id,
        tenant_id: d.tenant_id,
        tenant_name: d.tenants?.name || "Unknown",
        amount: d.amount,
        currency: d.currency,
        reason: d.reason,
        status: d.status || d.stage,
        created_at: d.created_at,
        due_by: d.due_at,
      })) || [];

      setDisputes(transformedDisputes);
    } catch (error) {
      console.error("Error loading disputes:", error);
      toast.error("ไม่สามารถโหลด disputes ได้");
    } finally {
      setLoading(false);
    }
  };

  const filteredDisputes = disputes.filter(
    (dispute) =>
      dispute.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.payment_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.tenant_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: Dispute["status"]) => {
    const variants = {
      pending: "secondary",
      under_review: "default",
      won: "default",
      lost: "destructive",
    } as const;
    return <Badge variant={variants[status]}>{status.replace("_", " ")}</Badge>;
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
          <h1 className="text-3xl font-bold">Disputes (Cross-Tenant View)</h1>
          <p className="text-muted-foreground">ติดตาม disputes จากทุก tenant (read-only)</p>
        </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          📖 หน้านี้เป็น read-only view สำหรับ Super Admin เท่านั้น
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Disputes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{disputes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {disputes.filter((d) => d.status === "pending").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Under Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {disputes.filter((d) => d.status === "under_review").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Won</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {disputes.filter((d) => d.status === "won").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ค้นหา Disputes</CardTitle>
          <CardDescription>ค้นหาด้วย dispute ID, payment ID, หรือ tenant name</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>ค้นหา</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหา dispute ID, payment ID, tenant..."
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
          <CardTitle>Disputes ({filteredDisputes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispute ID</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Due By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDisputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    ไม่พบ disputes
                  </TableCell>
                </TableRow>
              ) : (
                filteredDisputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell className="font-mono text-sm">{dispute.id}</TableCell>
                    <TableCell className="font-mono text-sm">{dispute.payment_id}</TableCell>
                    <TableCell>{dispute.tenant_name}</TableCell>
                    <TableCell>
                      {dispute.amount.toLocaleString()} {dispute.currency}
                    </TableCell>
                    <TableCell>{dispute.reason.replace("_", " ")}</TableCell>
                    <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                    <TableCell>{new Date(dispute.created_at).toLocaleDateString("th-TH")}</TableCell>
                    <TableCell>
                      {dispute.due_by ? new Date(dispute.due_by).toLocaleDateString("th-TH") : "-"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
    </div>
  );
};

export default PlatformDisputes;
