import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Shield,
  AlertCircle,
  Webhook,
  Key,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { RequireTenant } from "@/components/RequireTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { format, startOfMonth, subMonths, startOfDay } from "date-fns";
import { Link, Navigate } from "react-router-dom";
import { useMfaGuard } from "@/hooks/useMfaGuard";
import { useMfaLoginGuard } from "@/hooks/useMfaLoginGuard";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { useRoleVisibility } from "@/hooks/useRoleVisibility";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { toast } from "sonner";
import { useShareholder } from "@/hooks/useShareholder";

const Dashboard = () => {
  const { user, isSuperAdmin, publicId } = useAuth();
  const { activeTenantId } = useTenantSwitcher();
  const roleVisibility = useRoleVisibility();
  const mfaChallenge = use2FAChallenge();
  const { isShareholder } = useShareholder();
  
  useMfaLoginGuard();
  useMfaGuard({ required: false });

  // Super Admin should use /admin dashboard, not tenant dashboard
  const redirectToAdmin = isSuperAdmin;

  // Financial queries (Owner/Manager/Finance)
  const { data: wallet } = useQuery({
    queryKey: ["wallet", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return null;
      const { data } = await supabase
        .from("tenant_wallets")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .single();
      return data;
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewFinancialOverview,
  });

  const { data: currentMonthDeposits, isLoading: loadingCurrentDeposits } = useQuery({
    queryKey: ["deposits-current-month", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return { total: 0, count: 0 };
      const startDate = startOfMonth(new Date());
      const { data } = await supabase
        .from("payments")
        .select("amount")
        .eq("tenant_id", activeTenantId)
        .eq("type", "deposit")
        .eq("status", "succeeded")
        .gte("created_at", startDate.toISOString());
      
      const total = data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      return { total: total / 100, count: data?.length || 0 };
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewFinancialOverview,
  });

  const { data: lastMonthDeposits } = useQuery({
    queryKey: ["deposits-last-month", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return { total: 0 };
      const startDate = startOfMonth(subMonths(new Date(), 1));
      const endDate = startOfMonth(new Date());
      const { data } = await supabase
        .from("payments")
        .select("amount")
        .eq("tenant_id", activeTenantId)
        .eq("type", "deposit")
        .eq("status", "succeeded")
        .gte("created_at", startDate.toISOString())
        .lt("created_at", endDate.toISOString());
      
      const total = data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      return { total: total / 100 };
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewFinancialOverview,
  });

  const { data: depositStats } = useQuery({
    queryKey: ["deposit-stats", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return { total: 0, successful: 0 };
      const { data } = await supabase
        .from("payments")
        .select("status")
        .eq("tenant_id", activeTenantId)
        .eq("type", "deposit");
      
      const successful = data?.filter(p => p.status === "succeeded").length || 0;
      return { total: data?.length || 0, successful };
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewFinancialOverview,
  });

  const { data: todayStats } = useQuery({
    queryKey: ["today-stats", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return { count: 0 };
      const today = startOfDay(new Date());
      const { data } = await supabase
        .from("payments")
        .select("id")
        .eq("tenant_id", activeTenantId)
        .gte("created_at", today.toISOString());
      
      return { count: data?.length || 0 };
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewFinancialOverview,
  });

  // Approvals (Owner/Manager only)
  const { data: pendingApprovals } = useQuery({
    queryKey: ["pending-approvals", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data } = await supabase
        .from("approvals")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewApprovals,
  });

  // Alerts (Owner/Manager only)
  const { data: activeAlerts } = useQuery({
    queryKey: ["active-alerts", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewRiskAlerts,
  });

  // Dev metrics (Developer/Owner only)
  const { data: devMetrics, isLoading: loadingDevMetrics } = useQuery({
    queryKey: ["dev-metrics", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return null;
      const { data, error } = await invokeFunctionWithTenant("dashboard-dev-metrics");
      if (error) {
        console.error("Failed to fetch dev metrics:", error);
        return null;
      }
      return data;
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewAPIMetrics,
  });

  // Recent transactions (Owner/Manager/Finance)
  const { data: recentTransactions, isLoading: loadingRecent } = useQuery({
    queryKey: ["recent-transactions", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.canViewPayments,
  });

  // Recent withdrawals (Finance specific)
  const { data: recentWithdrawals, isLoading: loadingWithdrawals } = useQuery({
    queryKey: ["recent-withdrawals", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .eq("type", "withdrawal")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.isFinance,
  });

  // Recent settlements (Finance specific)
  const { data: recentSettlements, isLoading: loadingSettlements } = useQuery({
    queryKey: ["recent-settlements", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data } = await supabase
        .from("settlements")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!activeTenantId && !redirectToAdmin && roleVisibility.isFinance,
  });

  const calculatePercentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const depositChange = calculatePercentChange(
    currentMonthDeposits?.total || 0,
    lastMonthDeposits?.total || 0
  );

  if (redirectToAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return (
    <DashboardLayout>
      <RequireTenant>
        <TwoFactorChallenge
          open={mfaChallenge.isOpen}
          onOpenChange={mfaChallenge.setIsOpen}
          onSuccess={mfaChallenge.onSuccess}
        />
        
        <div className="p-6 space-y-6 max-w-[1600px]">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                แดชบอร์ด
                <Badge className={`ml-3 text-xs font-semibold ${
                  isShareholder ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0' :
                  roleVisibility.currentRole === 'owner' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0' :
                  roleVisibility.currentRole === 'manager' ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0' :
                  roleVisibility.currentRole === 'finance' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0' :
                  roleVisibility.currentRole === 'developer' ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white border-0' :
                  ''
                }`}>
                  {isShareholder ? 'SHAREHOLDER' : roleVisibility.currentRole?.toUpperCase()}
                </Badge>
              </h1>
              <p className="text-muted-foreground mt-1">
                ยินดีต้อนรับ <span className="font-mono">{publicId || "-"}</span>
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {roleVisibility.canViewPayouts && (
                <>
                  <Button variant="outline" size="sm" asChild className="hover:bg-cyan-50 dark:hover:bg-cyan-950/20 hover:border-cyan-300 hover:text-cyan-700 dark:hover:text-cyan-400 transition-all">
                    <Link to="/deposit-list">
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      ฝากเงิน
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="hover:bg-pink-50 dark:hover:bg-pink-950/20 hover:border-pink-300 hover:text-pink-700 dark:hover:text-pink-400 transition-all">
                    <Link to="/withdrawal-list">
                      <ArrowDownRight className="mr-2 h-4 w-4" />
                      ถอนเงิน
                    </Link>
                  </Button>
                </>
              )}
              {roleVisibility.canCreatePaymentLink && (
                <Button size="sm" asChild className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white border-0 shadow-lg">
                  <Link to="/links">
                    <Zap className="mr-2 h-4 w-4" />
                    สร้างลิงก์ชำระ
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Financial KPIs (Owner/Manager/Finance) */}
          {roleVisibility.canViewFinancialOverview && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background shadow-lg hover:shadow-xl transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">ยอดรับวันนี้</CardTitle>
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCurrentDeposits ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        ฿{new Intl.NumberFormat('th-TH').format(currentMonthDeposits?.total ?? 0)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {currentMonthDeposits?.count || 0} รายการ
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background shadow-lg hover:shadow-xl transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">เดือนนี้</CardTitle>
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    ฿{new Intl.NumberFormat('th-TH').format(currentMonthDeposits?.total ?? 0)}
                  </div>
                  <div className="flex items-center text-xs mt-2">
                    {depositChange >= 0 ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <TrendingUp className="h-3 w-3" />
                        <span className="font-medium">+{depositChange.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        <TrendingDown className="h-3 w-3" />
                        <span className="font-medium">{depositChange.toFixed(1)}%</span>
                      </div>
                    )}
                    <span className="ml-2 text-muted-foreground">จากเดือนที่แล้ว</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background shadow-lg hover:shadow-xl transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Success Rate</CardTitle>
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {depositStats?.total ? 
                      Math.round((depositStats.successful / depositStats.total) * 100) : 
                      100}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {depositStats?.successful || 0}/{depositStats?.total || 0} สำเร็จ
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background shadow-lg hover:shadow-xl transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">ยอดคงเหลือ</CardTitle>
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    ฿{((wallet?.balance || 0) / 100).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {todayStats?.count || 0} รายการวันนี้
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Approvals (Owner/Manager) */}
              {roleVisibility.canViewApprovals && (
                <Card className="border-t-4 border-t-indigo-500 shadow-lg hover:shadow-xl transition-all">
                  <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                    <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                      <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                        <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      อนุมัติที่รอดำเนินการ
                    </CardTitle>
                    <CardDescription>
                      คำขอที่ต้องการการอนุมัติ
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!pendingApprovals || pendingApprovals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        ไม่มีรายการรออนุมัติ
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {pendingApprovals.map((approval) => (
                          <div key={approval.id} className="flex items-start justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{approval.action_type}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(approval.created_at), "dd/MM/yyyy HH:mm")}
                              </p>
                            </div>
                            <Badge variant="secondary">รอดำเนินการ</Badge>
                          </div>
                        ))}
                        <Button variant="link" size="sm" asChild className="w-full">
                          <Link to="/approvals">ดูทั้งหมด →</Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Alerts (Owner/Manager) */}
              {roleVisibility.canViewRiskAlerts && (
                <Card className="border-t-4 border-t-rose-500 shadow-lg hover:shadow-xl transition-all">
                  <CardHeader className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/20 dark:to-red-950/20">
                    <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                        <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      การแจ้งเตือนและความเสี่ยง
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!activeAlerts || activeAlerts.length === 0 ? (
                      <div className="text-center py-4">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          ไม่มีการแจ้งเตือน ทุกอย่างปกติ
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeAlerts.map((alert) => (
                          <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                            <AlertCircle className={`h-5 w-5 mt-0.5 ${
                              alert.type === 'critical' ? 'text-red-600' :
                              alert.type === 'warning' ? 'text-yellow-600' :
                              'text-blue-600'
                            }`} />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{alert.name}</p>
                              <p className="text-xs text-muted-foreground">{alert.type}</p>
                            </div>
                            <Badge variant={alert.type === 'critical' ? 'destructive' : 'secondary'}>
                              {alert.type}
                            </Badge>
                          </div>
                        ))}
                        <Button variant="link" size="sm" asChild className="w-full">
                          <Link to="/alerts">จัดการการแจ้งเตือน →</Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recent Transactions (Owner/Manager/Finance) */}
              {roleVisibility.canViewPayments && (
                <Card className="border-t-4 border-t-cyan-500 shadow-lg hover:shadow-xl transition-all">
                  <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20">
                    <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                      <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                        <DollarSign className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      รายการฝากล่าสุด
                    </CardTitle>
                    <CardDescription>รายการฝากเงินเข้าระบบล่าสุด</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingRecent ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                      </div>
                    ) : !recentTransactions || recentTransactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        ยังไม่มีรายการ
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {recentTransactions.filter(tx => tx.type === "deposit").slice(0, 5).map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                tx.status === "succeeded" ? "bg-green-100 text-green-700" : 
                                tx.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {tx.status === "succeeded" ? <CheckCircle2 className="h-5 w-5" /> :
                                 tx.status === "pending" ? <Clock className="h-5 w-5" /> :
                                 <XCircle className="h-5 w-5" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  ฝากเงิน
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">
                                ฿{(tx.amount / 100).toLocaleString()}
                              </p>
                              <Badge variant={tx.status === "succeeded" ? "default" : tx.status === "pending" ? "secondary" : "destructive"} className="text-xs">
                                {tx.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        <Button variant="link" size="sm" asChild className="w-full">
                          <Link to="/payments">ดูทั้งหมด →</Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Developer Metrics (Developer/Owner) */}
              {roleVisibility.canViewAPIMetrics && (
                <>
                  <Card className="border-t-4 border-t-violet-500 shadow-lg hover:shadow-xl transition-all">
                    <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
                      <CardTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
                        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                          <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        สถานะ API
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingDevMetrics ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Success Rate</p>
                              <p className="text-2xl font-bold text-green-600">
                                {devMetrics?.api_success_rate || 0}%
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Latency (p50)</p>
                              <p className="text-2xl font-bold">
                                {devMetrics?.latency_p50 || 0}ms
                              </p>
                            </div>
                          </div>
                          <div className="pt-4 border-t">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-muted-foreground">Errors (24h)</span>
                              <span className="text-sm font-medium">
                                4xx: {devMetrics?.http_4xx || 0} / 5xx: {devMetrics?.http_5xx || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-t-4 border-t-emerald-500 shadow-lg hover:shadow-xl transition-all">
                    <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
                      <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Key className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        API Keys
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Active Keys</span>
                          <Badge variant="secondary">{devMetrics?.active_api_keys || 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">หมดอายุเร็วๆ นี้</span>
                          <Badge variant={devMetrics?.expiring_soon ? "destructive" : "default"}>
                            {devMetrics?.expiring_soon || 0}
                          </Badge>
                        </div>
                        <Button variant="outline" size="sm" asChild className="w-full mt-2">
                          <Link to="/settings?tab=api-keys">
                            <Key className="mr-2 h-4 w-4" />
                            จัดการ API Keys
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-t-4 border-t-sky-500 shadow-lg hover:shadow-xl transition-all">
                    <CardHeader className="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20">
                      <CardTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
                        <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/30">
                          <Webhook className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                        </div>
                        Webhooks
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Success Rate</span>
                          <Badge variant={
                            (devMetrics?.webhook_success_rate || 0) >= 95 ? "default" : "destructive"
                          }>
                            {devMetrics?.webhook_success_rate || 0}%
                          </Badge>
                        </div>
                        <div className="space-y-2 pt-2 border-t">
                          <p className="text-xs text-muted-foreground">Deliveries ล่าสุด:</p>
                          {devMetrics?.recent_deliveries?.slice(0, 3).map((delivery: any) => (
                            <div key={delivery.id} className="flex items-center justify-between text-xs">
                              <span className="truncate max-w-[150px]">{delivery.endpoint}</span>
                              <Badge variant={delivery.status === 'delivered' ? 'default' : 'destructive'} className="text-xs">
                                {delivery.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" size="sm" asChild className="w-full mt-2">
                          <Link to="/webhook-events">
                            <Webhook className="mr-2 h-4 w-4" />
                            ดู Webhook Events
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Finance-specific widgets (Finance role) */}
              {roleVisibility.isFinance && (
                <>
                  {/* Recent Withdrawals */}
                  <Card className="border-t-4 border-t-pink-500 shadow-lg hover:shadow-xl transition-all">
                    <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20">
                      <CardTitle className="flex items-center gap-2 text-pink-700 dark:text-pink-400">
                        <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                          <ArrowDownRight className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                        </div>
                        คำขอถอนเงินล่าสุด
                      </CardTitle>
                      <CardDescription>
                        รายการถอนเงินและสถานะ
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingWithdrawals ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                        </div>
                      ) : !recentWithdrawals || recentWithdrawals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          ยังไม่มีคำขอถอนเงิน
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {recentWithdrawals.map((withdrawal) => (
                            <div key={withdrawal.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                  withdrawal.status === "succeeded" ? "bg-green-100 text-green-700" : 
                                  withdrawal.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                                }`}>
                                  <ArrowDownRight className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">ถอนเงิน</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(withdrawal.created_at), "dd/MM/yyyy HH:mm")}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">
                                  ฿{(withdrawal.amount / 100).toLocaleString()}
                                </p>
                                <Badge variant={
                                  withdrawal.status === "succeeded" ? "default" : 
                                  withdrawal.status === "pending" ? "secondary" : 
                                  "destructive"
                                } className="text-xs">
                                  {withdrawal.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                          <Button variant="link" size="sm" asChild className="w-full">
                            <Link to="/withdrawal-list">ดูทั้งหมด →</Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Settlements */}
                  <Card className="border-t-4 border-t-teal-500 shadow-lg hover:shadow-xl transition-all">
                    <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20">
                      <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                        <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                          <RefreshCw className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        Settlement ล่าสุด
                      </CardTitle>
                      <CardDescription>
                        สรุปการชำระเงินและสถานะ Settlement
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingSettlements ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                        </div>
                      ) : !recentSettlements || recentSettlements.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          ยังไม่มี Settlement
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {recentSettlements.map((settlement) => (
                            <div key={settlement.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                              <div>
                                <p className="font-medium text-sm">
                                  Settlement #{settlement.id.slice(0, 8)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(settlement.created_at), "dd/MM/yyyy")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">
                                  ฿{((settlement.net_amount || 0) / 100).toLocaleString()}
                                </p>
                                <Badge variant={
                                  settlement.paid_out_at ? "default" : "secondary"
                                } className="text-xs">
                                  {settlement.paid_out_at ? "Paid" : "Pending"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                          <Button variant="link" size="sm" asChild className="w-full">
                            <Link to="/settlements">ดูทั้งหมด →</Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Actions for Finance */}
                  <Card className="border-t-4 border-t-fuchsia-500 shadow-lg hover:shadow-xl transition-all">
                    <CardHeader className="bg-gradient-to-r from-fuchsia-50 to-purple-50 dark:from-fuchsia-950/20 dark:to-purple-950/20">
                      <CardTitle className="flex items-center gap-2 text-fuchsia-700 dark:text-fuchsia-400">
                        <div className="p-2 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/30">
                          <Zap className="h-5 w-5 text-fuchsia-600 dark:text-fuchsia-400" />
                        </div>
                        การดำเนินการด่วน
                      </CardTitle>
                      <CardDescription>
                        เครื่องมือสำหรับทีมการเงิน
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="outline" size="sm" asChild className="w-full hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all">
                        <Link to="/reconciliation">
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Reconciliation
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="w-full hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-300 hover:text-blue-700 dark:hover:text-blue-400 transition-all">
                        <Link to="/reports">
                          <Activity className="mr-2 h-4 w-4" />
                          รายงานทางการเงิน
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="w-full hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-300 hover:text-purple-700 dark:hover:text-purple-400 transition-all">
                        <Link to="/settlements">
                          <DollarSign className="mr-2 h-4 w-4" />
                          จัดการ Settlement
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default Dashboard;
