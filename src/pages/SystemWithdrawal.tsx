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

type PaymentStatus = "all" | "pending" | "processing" | "succeeded" | "expired" | "rejected";

export default function SystemWithdrawal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTenantId } = useTenantSwitcher();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Fetch withdrawals
  const { data: withdrawals, refetch: refetchWithdrawals } = useQuery({
    queryKey: ["withdrawals", statusFilter, activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      let query = supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .eq("type", "withdrawal")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId && isOwner,
  });

  const statusButtons: { value: PaymentStatus; label: string }[] = [
    { value: "all", label: "ทั้งหมด" },
    { value: "pending", label: "รอดำเนินการ" },
    { value: "processing", label: "กำลังดำเนินการ" },
    { value: "succeeded", label: "สำเร็จ" },
    { value: "rejected", label: "ถูกปฏิเสธ" },
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
                  placeholder="ค้นหา (เลขบัญชี, ชื่อธนาคาร)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={() => refetchWithdrawals()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>จำนวนเงิน</TableHead>
                    <TableHead>ธนาคาร</TableHead>
                    <TableHead>เลขที่บัญชี</TableHead>
                    <TableHead>ชื่อบัญชี</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!withdrawals || withdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        ไม่มีประวัติการถอนเงิน
                      </TableCell>
                    </TableRow>
                  ) : (
                    withdrawals
                      .filter((w) => {
                      if (!searchQuery) return true;
                        const search = searchQuery.toLowerCase();
                        return (
                          w.id.toLowerCase().includes(search) ||
                          w.method?.toLowerCase().includes(search)
                        );
                      })
                      .map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell>
                            {format(new Date(withdrawal.created_at), "yyyy-MM-dd HH:mm")}
                          </TableCell>
                          <TableCell className="font-medium">
                            ฿{(withdrawal.amount / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>{withdrawal.method || "-"}</TableCell>
                          <TableCell className="font-mono">-</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {withdrawal.provider_payment_id || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
