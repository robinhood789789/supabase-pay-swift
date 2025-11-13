import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Search, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, DollarSign, Calendar as CalendarIcon, Download, Eye, CheckCircle2, AlertCircle, Clock, Loader2, XCircle, Ban, FileX, Plus } from "lucide-react";
import { TransactionDetailDrawer } from "@/components/TransactionDetailDrawer";
import { SavedFiltersManager } from "@/components/SavedFiltersManager";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function TransactionDashboard() {
  const navigate = useNavigate();
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
    const statusConfig: Record<string, { className: string; icon: React.ReactNode }> = {
      SUCCESS: {
        className: "bg-success text-success-foreground border-success/20",
        icon: <CheckCircle2 className="w-3 h-3 mr-1" />
      },
      PENDING: {
        className: "bg-warning text-warning-foreground border-warning/20",
        icon: <Clock className="w-3 h-3 mr-1" />
      },
      PROCESSING: {
        className: "bg-primary text-primary-foreground border-primary/20",
        icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      },
      FAILED: {
        className: "bg-destructive text-destructive-foreground border-destructive/20",
        icon: <XCircle className="w-3 h-3 mr-1" />
      },
      CANCELED: {
        className: "bg-secondary text-secondary-foreground border-secondary/20",
        icon: <Ban className="w-3 h-3 mr-1" />
      },
    };
    
    const config = statusConfig[status] || {
      className: "bg-muted text-muted-foreground",
      icon: null
    };
    
    return (
      <Badge className={cn("flex items-center gap-1", config.className)}>
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string, direction: string) => {
    if (type === "DEPOSIT") {
      return (
        <Badge className="bg-success text-success-foreground border-success/20 flex items-center gap-1">
          <ArrowDownToLine className="w-3 h-3" />
          {type}
        </Badge>
      );
    } else if (type === "WITHDRAWAL") {
      return (
        <Badge className="bg-warning text-warning-foreground border-warning/20 flex items-center gap-1">
          <ArrowUpFromLine className="w-3 h-3" />
          {type}
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-primary text-primary-foreground border-primary/20 flex items-center gap-1">
          <ArrowLeftRight className="w-3 h-3" />
          {direction}
        </Badge>
      );
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

  const handleApplyFilter = (filters: any) => {
    // Convert ISO strings back to Date objects
    const dateRange = filters.dateRange || {};
    setStatusFilter(filters.statusFilter || "all");
    setTypeFilter(filters.typeFilter || "all");
    setVerifiedFilter(filters.verifiedFilter || "all");
    setDateRange({
      from: dateRange.from ? new Date(dateRange.from) : undefined,
      to: dateRange.to ? new Date(dateRange.to) : undefined,
    });
    toast.success("ใช้ Filter สำเร็จ");
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
              <h1 className="text-4xl font-bold text-foreground">
                Transaction Verification
              </h1>
              <p className="text-muted-foreground mt-1">
                ตรวจสอบและยืนยันธุรกรรมทางการเงิน
              </p>
              <Badge variant="secondary" className="mt-2">
                {currentRole?.toUpperCase()} ROLE
              </Badge>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-l-4 border-l-primary bg-card/80 backdrop-blur-xl shadow-glow hover:shadow-neon transition-all animate-in">
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

            <Card className="border-l-4 border-l-primary bg-card/80 backdrop-blur-xl shadow-glow hover:shadow-neon transition-all animate-in" style={{ animationDelay: "0.1s" }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Total Transactions</CardTitle>
                <div className="p-2 rounded-full bg-primary/10">
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {verifiedStats.total}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {transactions?.filter(t => t.status === "SUCCESS").length || 0} สำเร็จ
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-success bg-card/80 backdrop-blur-xl shadow-glow hover:shadow-neon transition-all animate-in" style={{ animationDelay: "0.2s" }}>
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

            <Card className="border-l-4 border-l-warning bg-card/80 backdrop-blur-xl shadow-glow hover:shadow-neon transition-all animate-in" style={{ animationDelay: "0.3s" }}>
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
          <Card className="border border-primary/20 bg-card/70 backdrop-blur-xl shadow-elegant hover:shadow-glow transition-all">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-primary" />
                    ตัวกรองการค้นหา
                  </CardTitle>
                  <CardDescription>กรองและค้นหาธุรกรรมตามเงื่อนไขต่างๆ</CardDescription>
                </div>
                <SavedFiltersManager
                  currentFilters={{
                    statusFilter,
                    typeFilter,
                    verifiedFilter,
                    dateRange,
                  }}
                  onApplyFilter={handleApplyFilter}
                />
              </div>
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
          <Card className="border border-primary/20 bg-card/70 backdrop-blur-xl shadow-elegant hover:shadow-glow transition-all">
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
                      {[...Array(5)].map((_, index) => (
                        <TableRow key={index} className="animate-fade-in">
                          <TableCell>
                            <Skeleton className="h-4 w-24 animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-28 animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-20 rounded-full animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-16 rounded-full animate-pulse" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="h-4 w-20 ml-auto animate-pulse" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="h-4 w-16 ml-auto animate-pulse" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="h-4 w-24 ml-auto animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-20 rounded-full animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-20 rounded-full animate-pulse" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-8 w-16 mx-auto rounded animate-pulse" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
                    <div className="relative p-6 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                      <FileX className="w-16 h-16 text-primary" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    ไม่พบรายการธุรกรรม
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md mb-8">
                    {searchQuery || statusFilter !== "all" || typeFilter !== "all" || verifiedFilter !== "all" 
                      ? "ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่อีกครั้ง"
                      : "คุณยังไม่มีรายการธุรกรรมในระบบ เริ่มต้นสร้างธุรกรรมใหม่ได้เลยตอนนี้"
                    }
                  </p>
                  
                  {!searchQuery && statusFilter === "all" && typeFilter === "all" && verifiedFilter === "all" && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => navigate("/deposit-list")}
                        className="bg-gradient-success text-white border-0 shadow-glow hover:shadow-neon transition-all group"
                      >
                        <ArrowDownToLine className="w-4 h-4 mr-2 group-hover:translate-y-1 transition-transform" />
                        สร้างรายการฝากเงิน
                      </Button>
                      <Button
                        onClick={() => navigate("/withdrawal-list")}
                        className="bg-gradient-withdrawal text-white border-0 shadow-glow hover:shadow-neon transition-all group"
                      >
                        <ArrowUpFromLine className="w-4 h-4 mr-2 group-hover:-translate-y-1 transition-transform" />
                        สร้างรายการถอนเงิน
                      </Button>
                    </div>
                  )}
                  
                  {(searchQuery || statusFilter !== "all" || typeFilter !== "all" || verifiedFilter !== "all") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                        setTypeFilter("all");
                        setVerifiedFilter("all");
                        setDateRange({ from: undefined, to: undefined });
                      }}
                      className="border-primary/20 hover:bg-primary/10 transition-all"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      ล้างตัวกรองทั้งหมด
                    </Button>
                  )}
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
