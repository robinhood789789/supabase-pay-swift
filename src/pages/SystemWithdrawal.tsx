import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { SystemWithdrawalDialog } from "@/components/SystemWithdrawalDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PaymentStatus = "all" | "pending" | "processing" | "succeeded" | "expired" | "rejected";

export default function SystemWithdrawal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTenantId } = useTenantSwitcher();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Check if user is owner
  useEffect(() => {
    const checkOwnerRole = async () => {
      if (!user || !activeTenantId) {
        setIsLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from("memberships")
        .select("role_id, roles!inner(name)")
        .eq("user_id", user.id)
        .eq("tenant_id", activeTenantId)
        .single();

      if ((membership as any)?.roles?.name === "owner") {
        setIsOwner(true);
      } else {
        navigate("/dashboard");
      }
      setIsLoading(false);
    };

    checkOwnerRole();
  }, [user, activeTenantId, navigate]);

  // Fetch wallet balance
  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ["tenant_wallets", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return null;
      const { data, error } = await supabase
        .from("tenant_wallets")
        .select("balance")
        .eq("tenant_id", activeTenantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId && isOwner,
  });

  // Fetch withdrawals from settlement_transfers
  const { data: withdrawals, refetch: refetchWithdrawals } = useQuery({
    queryKey: ["settlement-transfers-withdrawal", statusFilter, activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      let query: any = supabase
        .from("settlement_transfers" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTenantId && isOwner,
  });

  const statusButtons: { value: PaymentStatus; label: string }[] = [
    { value: "all", label: "ทั้งหมด" },
    { value: "pending", label: "รอดำเนินการ" },
    { value: "processing", label: "กำลังดำเนินการ" },
    { value: "completed" as any, label: "สำเร็จ" },
    { value: "failed" as any, label: "ล้มเหลว" },
    { value: "rejected", label: "ถูกปฏิเสธ" },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: "สำเร็จ", variant: "default" as const },
      pending: { label: "รอดำเนินการ", variant: "secondary" as const },
      processing: { label: "กำลังดำเนินการ", variant: "default" as const },
      failed: { label: "ล้มเหลว", variant: "destructive" as const },
      rejected: { label: "ถูกปฏิเสธ", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      variant: "secondary" as const 
    };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">กำลังโหลด...</div>
      </DashboardLayout>
    );
  }

  if (!isOwner) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <h1 className="text-3xl font-bold">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-muted-foreground">เฉพาะ Owner เท่านั้นที่สามารถเข้าถึงหน้านี้ได้</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">ถอนเงินออกจากระบบ (Owner Only)</h1>
          <SystemWithdrawalDialog />
        </div>

        {/* Wallet Balance */}
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-red-600" />
              ยอดเงินคงเหลือในกระเป๋า
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => refetchWallet()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-700">
              ฿{wallet ? (wallet.balance / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "0.00"}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              ยอดเงินพร้อมใช้งาน
            </p>
          </CardContent>
        </Card>

        {/* Withdrawals History */}
        <Card>
          <CardHeader>
            <CardTitle>ประวัติการถอนเงิน</CardTitle>
            <div className="flex flex-wrap gap-2 mt-4">
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
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา (Ref ID, TX ID, ชื่อผู้รับ, เลขบัญชี)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
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
              <Button variant="outline" onClick={() => refetchWithdrawals()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่สร้าง</TableHead>
                    <TableHead>Ref ID</TableHead>
                    <TableHead>TX ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>ชื่อผู้รับ</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead>ธนาคาร</TableHead>
                    <TableHead>เลขที่บัญชี</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>Sys Bank</TableHead>
                    <TableHead>Ops Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!withdrawals || withdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        ไม่มีประวัติการถอนเงิน
                      </TableCell>
                    </TableRow>
                  ) : (() => {
                    const filteredWithdrawals = withdrawals.filter((w: any) => {
                      if (!searchQuery) return true;
                      const search = searchQuery.toLowerCase();
                      return (
                        w.settlement_ref?.toLowerCase().includes(search) ||
                        w.tx_id?.toLowerCase().includes(search) ||
                        w.beneficiary_name?.toLowerCase().includes(search) ||
                        w.account_number?.toLowerCase().includes(search) ||
                        w.bank_name?.toLowerCase().includes(search)
                      );
                    });

                    const totalPages = Math.ceil(filteredWithdrawals.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedWithdrawals = filteredWithdrawals.slice(startIndex, endIndex);

                    if (paginatedWithdrawals.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                            ไม่พบข้อมูลที่ค้นหา
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return paginatedWithdrawals.map((withdrawal: any) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="text-xs">
                          {withdrawal.created_at ? format(new Date(withdrawal.created_at), "yyyy-MM-dd HH:mm:ss") : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{withdrawal.settlement_ref || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{withdrawal.tx_id || "-"}</TableCell>
                        <TableCell className="text-xs">{withdrawal.client_code || "-"}</TableCell>
                        <TableCell className="text-xs">{withdrawal.merchant_code || "-"}</TableCell>
                        <TableCell className="text-sm font-medium">{withdrawal.beneficiary_name || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          ฿{withdrawal.amount ? parseFloat(withdrawal.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "0.00"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">
                            {withdrawal.bank_code || withdrawal.bank_name || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{withdrawal.account_number || "-"}</TableCell>
                        <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        <TableCell className="text-xs">{withdrawal.sys_bank || "-"}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="secondary" className="text-xs">
                            {withdrawal.ops_type || "-"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {withdrawals && withdrawals.length > 0 && (() => {
              const filteredWithdrawals = withdrawals.filter((w: any) => {
                if (!searchQuery) return true;
                const search = searchQuery.toLowerCase();
                return (
                  w.settlement_ref?.toLowerCase().includes(search) ||
                  w.tx_id?.toLowerCase().includes(search) ||
                  w.beneficiary_name?.toLowerCase().includes(search) ||
                  w.account_number?.toLowerCase().includes(search) ||
                  w.bank_name?.toLowerCase().includes(search)
                );
              });

              const totalPages = Math.ceil(filteredWithdrawals.length / itemsPerPage);

              return (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    แสดง {Math.min(filteredWithdrawals.length, ((currentPage - 1) * itemsPerPage) + 1)} - {Math.min(currentPage * itemsPerPage, filteredWithdrawals.length)} จาก {filteredWithdrawals.length} รายการทั้งหมด
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
