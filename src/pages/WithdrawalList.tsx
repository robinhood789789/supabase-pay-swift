import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { WithdrawalRequestDialog } from "@/components/WithdrawalRequestDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { usePermissions } from "@/hooks/usePermissions";

type PaymentStatus = "all" | "pending" | "processing" | "succeeded" | "expired" | "rejected";

export default function WithdrawalList() {
  const { activeTenantId, activeTenant } = useTenantSwitcher();
  const { hasPermission } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Check user role
  const userRole = activeTenant?.roles?.name;
  const canCreateRequest = userRole === 'finance' || userRole === 'manager' || userRole === 'owner';

  const { data: queryResult, isLoading, refetch } = useQuery<{ data: any[], count: number }>({
    queryKey: ["withdrawals", statusFilter, activeTenantId, page, itemsPerPage],
    queryFn: async () => {
      if (!activeTenantId) return { data: [], count: 0 };

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from("payments")
        .select("*", { count: 'exact' })
        .eq("tenant_id", activeTenantId)
        .eq("type", "withdrawal")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!activeTenantId,
  });

  const withdrawals = queryResult?.data || [];
  const totalCount = queryResult?.count || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Count by status
  const statusCounts = {
    pending: withdrawals?.filter(w => w.status === "pending").length || 0,
    processing: withdrawals?.filter(w => w.status === "processing").length || 0,
    succeeded: withdrawals?.filter(w => w.status === "succeeded").length || 0,
    expired: withdrawals?.filter(w => w.status === "expired").length || 0,
    rejected: withdrawals?.filter(w => w.status === "rejected").length || 0,
  };

  const statusButtons: { value: PaymentStatus; label: string }[] = [
    { value: "pending", label: `รอดำเนินการ ${statusCounts.pending}` },
    { value: "processing", label: `กำลังดำเนินการ ${statusCounts.processing}` },
    { value: "succeeded", label: `สำเร็จ ${statusCounts.succeeded}` },
    { value: "expired", label: `หมดอายุ ${statusCounts.expired}` },
    { value: "rejected", label: `ถูกปฏิเสธ ${statusCounts.rejected}` },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      succeeded: { label: "สำเร็จ", variant: "default" as const },
      pending: { label: "รอดำเนินการ", variant: "secondary" as const },
      processing: { label: "กำลังดำเนินการ", variant: "default" as const },
      expired: { label: "หมดอายุ", variant: "destructive" as const },
      rejected: { label: "ถูกปฏิเสธ", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      variant: "secondary" as const 
    };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!hasPermission("withdrawals.view")) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <h1 className="text-3xl font-bold">จัดการรายการถอนเงินทั้งหมด</h1>
          <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">จัดการรายการถอนเงินทั้งหมด</h1>
          {canCreateRequest && <WithdrawalRequestDialog />}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              {statusButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={statusFilter === btn.value ? "default" : "outline"}
                  onClick={() => setStatusFilter(btn.value)}
                  size="sm"
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-2 block">สร้างเมื่อ</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">สร้างเมื่อ</SelectItem>
                    <SelectItem value="amount">จำนวนเงิน</SelectItem>
                    <SelectItem value="status">สถานะ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="กรองข้อความ (ชื่อบัญชี)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>TX ID</TableHead>
                    <TableHead>Ref ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>ผู้ค้า</TableHead>
                    <TableHead>จำนวนเงิน</TableHead>
                    <TableHead>จำนวนที่จ่าย</TableHead>
                    <TableHead>ธนาคาร</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ประเภท</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        กำลังโหลด...
                      </TableCell>
                    </TableRow>
                  ) : withdrawals && withdrawals.length > 0 ? (
                    withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>
                          {format(new Date(withdrawal.created_at), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-primary">
                          {withdrawal.id.slice(0, 12)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {withdrawal.provider_payment_id?.slice(0, 12) || "-"}
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{withdrawal.provider || "-"}</TableCell>
                        <TableCell>
                          ฿{(withdrawal.amount / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          ฿{(withdrawal.amount / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{withdrawal.method || "-"}</TableCell>
                        <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Bank Transfer</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        ไม่พบรายการถอนเงิน
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Items per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">แสดง</span>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setPage(1);
                }}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">รายการ</span>
              </div>

              {/* Page info */}
              <div className="text-sm text-muted-foreground">
                หน้า {page} จาก {totalPages} ({totalCount} รายการทั้งหมด)
              </div>

              {/* Pagination */}
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  {totalPages > 5 && page < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
