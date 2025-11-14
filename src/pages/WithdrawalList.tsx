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

  const { data: queryResult, isLoading, refetch } = useQuery<{ data: any[], count: number, statusCounts: any }>({
    queryKey: ["withdrawals", statusFilter, activeTenantId, page, itemsPerPage, searchQuery],
    queryFn: async () => {
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Query withdraw_transfers data
      let query = (supabase as any)
        .from("withdraw_transfers")
        .select("*", { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") {
        // Map status: "3" = succeeded, "0" = pending, "1" = processing, "2" = rejected
        const statusMap: Record<string, string> = {
          succeeded: "3",
          pending: "0",
          processing: "1",
          rejected: "2",
          expired: "4"
        };
        query = query.eq("status", statusMap[statusFilter]);
      }

      if (searchQuery) {
        query = query.or(`fullname.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,memberid.ilike.%${searchQuery}%,ref_id.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;
      if (error) {
        console.error("Error fetching withdraw_transfers:", error);
        throw error;
      }

      // Get all records to count by status
      const { data: allData } = await (supabase as any)
        .from("withdraw_transfers")
        .select("status");

      const statusCounts = {
        pending: allData?.filter((w: any) => w.status === "0").length || 0,
        processing: allData?.filter((w: any) => w.status === "1").length || 0,
        succeeded: allData?.filter((w: any) => w.status === "3").length || 0,
        expired: allData?.filter((w: any) => w.status === "4").length || 0,
        rejected: allData?.filter((w: any) => w.status === "2").length || 0,
      };

      return { data: data || [], count: count || 0, statusCounts };
    },
    enabled: true,
  });

  const withdrawals = queryResult?.data || [];
  const totalCount = queryResult?.count || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const statusCounts = queryResult?.statusCounts || {
    pending: 0,
    processing: 0,
    succeeded: 0,
    expired: 0,
    rejected: 0,
  };

  const statusButtons: { value: PaymentStatus; label: string }[] = [
    { value: "pending", label: `รอดำเนินการ ${statusCounts.pending}` },
    { value: "processing", label: `กำลังดำเนินการ ${statusCounts.processing}` },
    { value: "succeeded", label: `สำเร็จ ${statusCounts.succeeded}` },
    { value: "expired", label: `หมดอายุ ${statusCounts.expired}` },
    { value: "rejected", label: `ถูกปฏิเสธ ${statusCounts.rejected}` },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "3": { label: "สำเร็จ", variant: "default" },
      "0": { label: "รอดำเนินการ", variant: "secondary" },
      "1": { label: "กำลังดำเนินการ", variant: "outline" },
      "2": { label: "ถูกปฏิเสธ", variant: "destructive" },
      "4": { label: "หมดอายุ", variant: "destructive" },
    };

    const config = statusConfig[status] || { 
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
                    <TableHead className="w-16">ลำดับ</TableHead>
                    <TableHead>เวลาสมัคร</TableHead>
                    <TableHead>Ref ID</TableHead>
                    <TableHead>TX ID</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>ร้านค้า</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead className="text-right">Payout จำนวน</TableHead>
                    <TableHead>ธนาคาร</TableHead>
                    <TableHead>ผู้ดำเนินการ</TableHead>
                    <TableHead>สถานะกระบวนการ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8">
                        กำลังโหลด...
                      </TableCell>
                    </TableRow>
                  ) : withdrawals && withdrawals.length > 0 ? (
                    withdrawals.map((withdrawal, index) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="font-medium">
                          {(page - 1) * itemsPerPage + index + 1}
                        </TableCell>
                        <TableCell className="text-sm">
                          {withdrawal.createdate ? format(new Date(withdrawal.createdate), "yyyy-MM-dd HH:mm") : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-primary">
                          {withdrawal.ref_id || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-blue-600">
                          {withdrawal.withdrawid || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{withdrawal.fullname || "-"}</span>
                            <span className="text-xs text-muted-foreground">{withdrawal.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>{withdrawal.memberid || "-"}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ฿{Number(withdrawal.beforewithdrawamt || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          ฿{Number(withdrawal.withdrawamt || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {withdrawal.bankcode || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{withdrawal.staff_activename || "-"}</span>
                            <span className="text-xs text-muted-foreground">{withdrawal.staff_activeid || ""}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {withdrawal.statusbanktranfer ? (
                            <Badge variant="default">สำเร็จ</Badge>
                          ) : (
                            <Badge variant="secondary">กำลังดำเนินการ</Badge>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{withdrawal.cashtype || "withdraw"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Search className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
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
