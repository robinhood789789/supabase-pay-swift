import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { useRoleVisibility } from "@/hooks/useRoleVisibility";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Search, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, DollarSign, Calendar as CalendarIcon, Download, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { TransactionDetailDrawer } from "@/components/TransactionDetailDrawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function TransactionDashboard() {
  const { activeTenantId } = useTenantSwitcher();
  const { isViewer, currentRole } = useRoleVisibility();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
    queryKey: ["transactions", activeTenantId, statusFilter, typeFilter, verifiedFilter, dateRange],
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

      if (verifiedFilter !== "all") {
        query = query.eq("is_verified", verifiedFilter === "verified");
      }

      // Date range filter
      if (dateRange.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte("created_at", toDate.toISOString());
      }

      const { data, error } = await query;
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

  const handleExport = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error("ไม่มีข้อมูลให้ Export");
      return;
    }

    const csvContent = [
      ["วันที่", "Reference", "Type", "Method", "Amount", "Fee", "Net Amount", "Status", "Counterparty", "Verified"].join(","),
      ...filteredTransactions.map(tx => [
        format(new Date(tx.created_at), "dd/MM/yyyy HH:mm"),
        tx.reference || "",
        tx.type,
        tx.method,
        tx.amount,
        tx.fee,
        tx.net_amount,
        tx.status,
        tx.counterparty || "",
        tx.is_verified ? "Yes" : "No",
      ].join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.click();
    toast.success("Export สำเร็จ");
  };

  const handleViewDetail = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsDetailOpen(true);
  };

  const verifiedStats = {
    total: transactions?.length || 0,
    verified: transactions?.filter(t => t.is_verified).length || 0,
    unverified: transactions?.filter(t => !t.is_verified).length || 0,
  };

  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="space-y-6 animate-in">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Transaction Verification
              </h1>
              <p className="text-muted-foreground mt-1">
                ตรวจสอบและยืนยันธุรกรรมทางการเงิน
              </p>
              <Badge className="mt-2 bg-gradient-deposit text-white border-0">
                {currentRole?.toUpperCase()} ROLE
              </Badge>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-l-4 border-l-primary bg-gradient-to-br from-card to-background shadow-lg hover:shadow-glow transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Wallet Balance</CardTitle>
                <div className="p-2 rounded-full bg-gradient-deposit">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                {walletLoading ? (
                  <Skeleton className="h-8 w-full" />
                ) : (
                  <div className="text-3xl font-bold bg-gradient-balance bg-clip-text text-transparent">
                    ฿{wallet?.balance?.toLocaleString() || "0.00"}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{wallet?.currency || "THB"}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-success bg-gradient-to-br from-card to-background shadow-lg hover:shadow-glow-success transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Total Transactions</CardTitle>
                <div className="p-2 rounded-full bg-gradient-primary">
                  <ArrowLeftRight className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {verifiedStats.total}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {transactions?.filter(t => t.status === "SUCCESS").length || 0} สำเร็จ
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-success bg-gradient-to-br from-card to-background shadow-lg hover:shadow-glow-success transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Verified</CardTitle>
                <div className="p-2 rounded-full bg-gradient-success">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-success bg-clip-text text-transparent">
                  {verifiedStats.verified}
                </div>
                <p className="text-xs text-success mt-2">
                  {verifiedStats.total > 0 ? Math.round((verifiedStats.verified / verifiedStats.total) * 100) : 0}% ยืนยันแล้ว
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-warning bg-gradient-to-br from-card to-background shadow-lg hover:shadow-glow-warning transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Pending Verification</CardTitle>
                <div className="p-2 rounded-full bg-gradient-withdrawal">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-withdrawal bg-clip-text text-transparent">
                  {verifiedStats.unverified}
                </div>
                <p className="text-xs text-warning mt-2">
                  รอการตรวจสอบ
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                ตัวกรองการค้นหา
              </CardTitle>
              <CardDescription>กรองและค้นหาธุรกรรมตามเงื่อนไขต่างๆ</CardDescription>
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
                      className={typeFilter === btn.value ? "bg-gradient-primary text-white border-0" : ""}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Verified Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">สถานะการยืนยัน</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={verifiedFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVerifiedFilter("all")}
                    className={verifiedFilter === "all" ? "bg-gradient-primary text-white border-0" : ""}
                  >
                    All
                  </Button>
                  <Button
                    variant={verifiedFilter === "verified" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVerifiedFilter("verified")}
                    className={verifiedFilter === "verified" ? "bg-gradient-success text-white border-0" : ""}
                  >
                    Verified
                  </Button>
                  <Button
                    variant={verifiedFilter === "unverified" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVerifiedFilter("unverified")}
                    className={verifiedFilter === "unverified" ? "bg-gradient-withdrawal text-white border-0" : ""}
                  >
                    Unverified
                  </Button>
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

              {/* Date Range Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">ช่วงวันที่</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal flex-1",
                          !dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "เริ่มต้น"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal flex-1",
                          !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "สิ้นสุด"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(dateRange.from || dateRange.to) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: undefined, to: undefined })}
                    >
                      ล้าง
                    </Button>
                  )}
                </div>
              </div>

              {/* Export Button */}
              <div className="pt-2">
                <Button 
                  onClick={handleExport} 
                  className="w-full bg-gradient-primary text-white border-0 shadow-glow"
                  disabled={!filteredTransactions || filteredTransactions.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export รายงาน CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="border border-border/50 bg-card/50 backdrop-blur-sm shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
                รายการธุรกรรม
              </CardTitle>
              <CardDescription>
                แสดง <span className="font-semibold text-foreground">{filteredTransactions?.length || 0}</span> รายการจาก <span className="font-semibold text-foreground">{transactions?.length || 0}</span> รายการทั้งหมด
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
                        <TableHead>Verified</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
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
                          <TableCell>
                            {tx.is_verified ? (
                              <Badge className="bg-gradient-success text-white border-0 shadow-glow-success">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge className="bg-gradient-withdrawal text-white border-0 shadow-glow-warning animate-pulse-glow">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(tx)}
                              className="hover:bg-primary/10 hover:text-primary transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
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

        {/* Transaction Detail Drawer */}
        <TransactionDetailDrawer
          transaction={selectedTransaction}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
        />
      </RequireTenant>
    </DashboardLayout>
  );
}
