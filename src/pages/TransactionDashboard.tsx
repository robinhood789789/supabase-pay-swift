import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Search, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function TransactionDashboard() {
  const { activeTenantId } = useTenantSwitcher();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ดึงข้อมูลยอด wallet
  const { data: wallet, isLoading: walletLoading } = useQuery({
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

  // ดึงข้อมูล transactions
  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ["transactions", activeTenantId, statusFilter, typeFilter],
    queryFn: async () => {
      if (!activeTenantId) return [];
      
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter.toUpperCase() as any);
      }
      
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter.toUpperCase() as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTenantId,
  });

  // ดึงข้อมูลสรุปรายวัน
  const { data: dailySummary } = useQuery({
    queryKey: ["daily-summary", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data, error } = await supabase
        .from("v_tx_daily_by_tenant")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("tx_date", { ascending: false })
        .limit(7);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTenantId,
  });

  // กรองตาม search query
  const filteredTransactions = transactions?.filter((tx) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      tx.reference?.toLowerCase().includes(search) ||
      tx.counterparty?.toLowerCase().includes(search) ||
      tx.note?.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SUCCESS: "default",
      PENDING: "secondary",
      PROCESSING: "outline",
      FAILED: "destructive",
      CANCELED: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getTypeBadge = (type: string, direction: string) => {
    if (type === "DEPOSIT") {
      return <Badge className="bg-green-500 text-white"><ArrowDownToLine className="w-3 h-3 mr-1" />{type}</Badge>;
    } else if (type === "WITHDRAWAL") {
      return <Badge className="bg-red-500 text-white"><ArrowUpFromLine className="w-3 h-3 mr-1" />{type}</Badge>;
    } else {
      return <Badge className="bg-blue-500 text-white"><ArrowLeftRight className="w-3 h-3 mr-1" />{direction}</Badge>;
    }
  };

  const statusButtons = [
    { label: "All", value: "all" },
    { label: "Success", value: "success" },
    { label: "Pending", value: "pending" },
    { label: "Processing", value: "processing" },
    { label: "Failed", value: "failed" },
  ];

  const typeButtons = [
    { label: "All", value: "all" },
    { label: "Deposit", value: "deposit" },
    { label: "Withdrawal", value: "withdrawal" },
    { label: "Transfer", value: "transfer" },
  ];

  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transaction Dashboard</h1>
            <p className="text-muted-foreground">
              ภาพรวมและรายละเอียดธุรกรรมทั้งหมด
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {walletLoading ? (
                  <Skeleton className="h-8 w-full" />
                ) : (
                  <div className="text-2xl font-bold">
                    ฿{wallet?.balance?.toLocaleString() || "0.00"}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{wallet?.currency || "THB"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total In (7 days)</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ฿{dailySummary?.reduce((sum, day) => sum + (day.net_in || 0), 0).toLocaleString() || "0.00"}
                </div>
                <p className="text-xs text-muted-foreground">เงินเข้า</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Out (7 days)</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ฿{dailySummary?.reduce((sum, day) => sum + (day.net_out || 0), 0).toLocaleString() || "0.00"}
                </div>
                <p className="text-xs text-muted-foreground">เงินออก</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transactions?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {transactions?.filter(t => t.status === "SUCCESS").length || 0} success
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>ตัวกรอง</CardTitle>
              <CardDescription>กรองรายการธุรกรรมตามสถานะและประเภท</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">สถานะ</label>
                <div className="flex flex-wrap gap-2">
                  {statusButtons.map((btn) => (
                    <Button
                      key={btn.value}
                      variant={statusFilter === btn.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(btn.value)}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">ประเภท</label>
                <div className="flex flex-wrap gap-2">
                  {typeButtons.map((btn) => (
                    <Button
                      key={btn.value}
                      variant={typeFilter === btn.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTypeFilter(btn.value)}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">ค้นหา</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาด้วย reference, counterparty, หรือ note..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>รายการธุรกรรม</CardTitle>
              <CardDescription>
                แสดง {filteredTransactions?.length || 0} รายการจาก {transactions?.length || 0} รายการทั้งหมด
              </CardDescription>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredTransactions && filteredTransactions.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Fee</TableHead>
                        <TableHead className="text-right">Net Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Counterparty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(tx.created_at), "dd/MM/yy HH:mm")}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{tx.reference || "-"}</TableCell>
                          <TableCell>{getTypeBadge(tx.type, tx.direction)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{tx.method}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ฿{tx.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            ฿{tx.fee.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            <span className={tx.direction === "IN" ? "text-green-600" : "text-red-600"}>
                              {tx.direction === "IN" ? "+" : "-"}฿{tx.net_amount.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(tx.status)}</TableCell>
                          <TableCell className="text-sm">{tx.counterparty || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>ไม่พบรายการธุรกรรม</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
}
