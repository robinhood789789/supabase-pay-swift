import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import SystemDepositDialog from "@/components/SystemDepositDialog";
import { Wallet, ShieldAlert } from "lucide-react";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PaymentStatus = "all" | "pending" | "completed";

export default function SystemDeposit() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTenantId } = useTenantSwitcher();
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Check if user is owner
  useEffect(() => {
    const checkOwnerRole = async () => {
      if (!user || !activeTenantId) {
        setIsOwner(false);
        return;
      }

      const { data, error } = await supabase
        .from("memberships")
        .select("role_id, roles(name)")
        .eq("user_id", user.id)
        .eq("tenant_id", activeTenantId)
        .single();

      if (error || !data) {
        setIsOwner(false);
        toast.error("ไม่สามารถตรวจสอบสิทธิ์ได้");
        navigate("/dashboard");
        return;
      }

      const roleName = (data.roles as any)?.name;
      if (roleName !== "owner") {
        setIsOwner(false);
        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้", {
          description: "หน้านี้สำหรับ Owner เท่านั้น",
        });
        navigate("/dashboard");
      } else {
        setIsOwner(true);
      }
    };

    checkOwnerRole();
  }, [user, activeTenantId, navigate]);

  // Query for wallet balance
  const { data: wallet } = useQuery({
    queryKey: ["tenant-wallet", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return null;
      const { data, error } = await supabase
        .from("tenant_wallets")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  const { data: deposits, isLoading, refetch } = useQuery({
    queryKey: ["topup-transfers", statusFilter, activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      
      let query: any = supabase
        .from("topup_transfers" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTenantId,
  });

  const statusButtons: { value: PaymentStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: "Completed", variant: "default" as const },
      succeeded: { label: "Completed", variant: "default" as const },
      pending: { label: "Pending", variant: "secondary" as const },
      processing: { label: "Processing", variant: "default" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      variant: "secondary" as const 
    };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Show loading while checking permissions
  if (isOwner === null) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">กำลังตรวจสอบสิทธิ์...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Don't render if not owner (will redirect)
  if (!isOwner) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-6 w-6" />
                <h3 className="text-lg font-semibold">ไม่มีสิทธิ์เข้าถึง</h3>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                หน้านี้สำหรับ Owner เท่านั้น คุณจะถูกนำกลับไปยังหน้าหลัก...
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">ระบบเติมเงิน</h1>
            <p className="text-muted-foreground mt-1">จัดการการเติมเงินเข้า Wallet ขององค์กร</p>
          </div>
          <SystemDepositDialog />
        </div>

        {/* Wallet Balance Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Wallet className="h-5 w-5" />
              <h3 className="font-semibold">Wallet Balance</h3>
            </div>
            <CardDescription>ยอดเงินคงเหลือในระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {wallet ? (
                <>
                  ฿{(wallet.balance / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </>
              ) : (
                <span className="text-muted-foreground">Loading...</span>
              )}
            </div>
            {wallet?.updated_at && (
              <p className="text-xs text-muted-foreground mt-2">
                อัพเดทล่าสุด: {format(new Date(wallet.updated_at), "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">ประวัติการเติมเงิน</h3>
              <p className="text-sm text-muted-foreground">รายการเติมเงินทั้งหมดของกองค์กร</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {statusButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={statusFilter === btn.value ? "default" : "ghost"}
                  onClick={() => setStatusFilter(btn.value)}
                  size="sm"
                  className={statusFilter === btn.value ? "" : "text-muted-foreground"}
                >
                  {btn.label}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="ค้นหาด้วย Topup Ref, Ref ID, Client, Merchant..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="max-w-sm"
              />
              <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => refetch()}>
                รีเฟรช
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่สร้าง</TableHead>
                    <TableHead>Topup Ref</TableHead>
                    <TableHead>Ref ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead>ธนาคาร</TableHead>
                    <TableHead>เลขบัญชี</TableHead>
                    <TableHead>ชื่อบัญชี</TableHead>
                    <TableHead>วิธีการ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่โอน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : deposits && deposits.length > 0 ? (() => {
                    const filteredDeposits = deposits.filter((deposit: any) => {
                      if (!searchQuery) return true;
                      const search = searchQuery.toLowerCase();
                      return (
                        deposit.topup_ref?.toLowerCase().includes(search) ||
                        deposit.ref_id?.toLowerCase().includes(search) ||
                        deposit.client_code?.toLowerCase().includes(search) ||
                        deposit.merchant_code?.toLowerCase().includes(search) ||
                        deposit.account_name?.toLowerCase().includes(search) ||
                        deposit.account_number?.toLowerCase().includes(search)
                      );
                    });

                    const totalPages = Math.ceil(filteredDeposits.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedDeposits = filteredDeposits.slice(startIndex, endIndex);

                    if (paginatedDeposits.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                            ไม่พบข้อมูลที่ค้นหา
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return paginatedDeposits.map((deposit: any) => (
                      <TableRow key={deposit.id}>
                        <TableCell className="text-xs">
                          {deposit.created_at ? format(new Date(deposit.created_at), "dd/MM/yyyy HH:mm:ss") : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {deposit.topup_ref || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {deposit.ref_id || "-"}
                        </TableCell>
                        <TableCell className="text-xs">{deposit.client_code || "-"}</TableCell>
                        <TableCell className="text-xs">{deposit.merchant_code || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          ฿{deposit.amount ? parseFloat(deposit.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : "0.00"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">
                            {deposit.bank_code || deposit.bank_name || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{deposit.account_number || "-"}</TableCell>
                        <TableCell className="text-sm">{deposit.account_name || "-"}</TableCell>
                        <TableCell className="text-xs capitalize">{deposit.method?.replace('_', ' ') || "-"}</TableCell>
                        <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                        <TableCell className="text-xs">
                          {deposit.transfer_date ? format(new Date(deposit.transfer_date), "dd/MM/yyyy HH:mm") : "-"}
                        </TableCell>
                      </TableRow>
                    ));
                  })() : (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <div className="text-4xl">💰</div>
                          <div>ยังไม่มีรายการเติมเงิน</div>
                          <p className="text-xs">เริ่มเติมเงินเข้าระบบได้เลย</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {deposits && deposits.length > 0 && (() => {
              const filteredDeposits = deposits.filter((deposit: any) => {
                if (!searchQuery) return true;
                const search = searchQuery.toLowerCase();
                return (
                  deposit.topup_ref?.toLowerCase().includes(search) ||
                  deposit.ref_id?.toLowerCase().includes(search) ||
                  deposit.client_code?.toLowerCase().includes(search) ||
                  deposit.merchant_code?.toLowerCase().includes(search) ||
                  deposit.account_name?.toLowerCase().includes(search) ||
                  deposit.account_number?.toLowerCase().includes(search)
                );
              });

              const totalPages = Math.ceil(filteredDeposits.length / itemsPerPage);

              return (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    แสดง {Math.min(filteredDeposits.length, ((currentPage - 1) * itemsPerPage) + 1)} - {Math.min(currentPage * itemsPerPage, filteredDeposits.length)} จาก {filteredDeposits.length} รายการทั้งหมด
                  </div>
                  {totalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNumber;
                          if (totalPages <= 5) {
                            pageNumber = i + 1;
                          } else if (currentPage <= 3) {
                            pageNumber = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNumber = totalPages - 4 + i;
                          } else {
                            pageNumber = currentPage - 2 + i;
                          }
                          
                          return (
                            <PaginationItem key={pageNumber}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNumber)}
                                isActive={currentPage === pageNumber}
                                className="cursor-pointer"
                              >
                                {pageNumber}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}

                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
