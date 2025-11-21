import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, AlertCircle, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface Refund {
  id: string;
  payment_id: string;
  tenant_id: string;
  tenant_name: string;
  amount: number;
  currency: string;
  reason: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  created_at: string;
  processed_at?: string;
}

const PlatformRefunds = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    if (!user || !isSuperAdmin) return;

    // Audit: Page view
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "platform.refunds.view",
      target_type: "platform_refunds",
      ip_address: "",
      user_agent: navigator.userAgent,
    });

    loadRefunds();
  }, [user, isSuperAdmin]);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      // Cross-tenant query - Super Admin can see all
      const { data, error } = await supabase
        .from("refunds")
        .select(`
          id,
          payment_id,
          tenant_id,
          tenants!inner(name),
          amount,
          reason,
          status,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const transformedRefunds = data?.map((r: any) => ({
        id: r.id,
        payment_id: r.payment_id,
        tenant_id: r.tenant_id,
        tenant_name: r.tenants?.name || "Unknown",
        amount: r.amount,
        currency: "THB",
        reason: r.reason || "customer_request",
        status: r.status,
        created_at: r.created_at,
        processed_at: r.status === "succeeded" ? r.created_at : undefined,
      })) || [];

      setRefunds(transformedRefunds);
    } catch (error) {
      console.error("Error loading refunds:", error);
      toast.error("ไม่สามารถโหลด refunds ได้");
    } finally {
      setLoading(false);
    }
  };

  const filteredRefunds = refunds.filter(
    (refund) =>
      refund.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.payment_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.tenant_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: Refund["status"]) => {
    const variants = {
      pending: "secondary",
      processing: "default",
      succeeded: "default",
      failed: "destructive",
    } as const;
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  // Pagination
  const totalPages = Math.ceil(filteredRefunds.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRefunds = filteredRefunds.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-foreground" />
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
          <h1 className="text-3xl font-bold">Refunds (Cross-Tenant View)</h1>
          <p className="text-muted-foreground">ติดตาม refunds จากทุก tenant (read-only)</p>
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
            <CardTitle>Total Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{refunds.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {refunds.filter((r) => r.status === "pending").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {refunds.filter((r) => r.status === "processing").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Succeeded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {refunds.filter((r) => r.status === "succeeded").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ค้นหา Refunds</CardTitle>
          <CardDescription>ค้นหาด้วย refund ID, payment ID, หรือ tenant name</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>ค้นหา</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหา refund ID, payment ID, tenant..."
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
          <CardTitle>Refunds ({filteredRefunds.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Refund ID</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRefunds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    ไม่พบ refunds
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRefunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="font-mono text-sm">{refund.id}</TableCell>
                    <TableCell className="font-mono text-sm">{refund.payment_id}</TableCell>
                    <TableCell>{refund.tenant_name}</TableCell>
                    <TableCell>
                      {refund.amount.toLocaleString()} {refund.currency}
                    </TableCell>
                    <TableCell>{refund.reason.replace("_", " ")}</TableCell>
                    <TableCell>{getStatusBadge(refund.status)}</TableCell>
                    <TableCell>{new Date(refund.created_at).toLocaleDateString("th-TH")}</TableCell>
                    <TableCell>
                      {refund.processed_at
                        ? new Date(refund.processed_at).toLocaleDateString("th-TH")
                        : "-"}
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

          {filteredRefunds.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center mt-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">แสดง</Label>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">รายการ</span>
              </div>

              <div className="flex justify-center">
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      ก่อนหน้า
                    </Button>
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm">
                        {currentPage} / {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      ถัดไป
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-sm text-muted-foreground text-right">
                แสดง {startIndex + 1}-{Math.min(endIndex, filteredRefunds.length)} จาก {filteredRefunds.length}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
    </div>
  );
};

export default PlatformRefunds;
