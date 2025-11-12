import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  KeyRound,
  Activity,
  TrendingUp,
  Shield,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Wallet,
  Trophy,
} from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function PlatformOverview() {
  // Fetch shareholders count
  const { data: shareholdersCount, isLoading: loadingShareholders } = useQuery({
    queryKey: ["shareholders-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("shareholders")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count || 0;
    },
  });

  // Fetch tenants count
  const { data: tenantsData, isLoading: loadingTenants } = useQuery({
    queryKey: ["tenants-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("status");
      
      const total = data?.length || 0;
      const active = data?.filter(t => t.status === "active").length || 0;
      return { total, active };
    },
  });

  // Fetch providers count
  const { data: providersCount, isLoading: loadingProviders } = useQuery({
    queryKey: ["providers-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("platform_provider_credentials")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Fetch recent admin activities
  const { data: recentActivities, isLoading: loadingActivities } = useQuery({
    queryKey: ["recent-admin-activities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_activity")
        .select("*, profiles!admin_activity_admin_user_id_fkey(full_name, public_id)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Fetch recent audit logs
  const { data: recentAudits, isLoading: loadingAudits } = useQuery({
    queryKey: ["recent-audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
  });

  // Fetch Top 5 Tenants by Transaction Volume (current month)
  const { data: topTenants, isLoading: loadingTopTenants } = useQuery({
    queryKey: ["top-tenants-volume"],
    queryFn: async () => {
      const startDate = startOfMonth(new Date());
      
      // Get payments for current month grouped by tenant
      const { data: payments } = await supabase
        .from("payments")
        .select("tenant_id, amount, tenants(name)")
        .gte("created_at", startDate.toISOString())
        .eq("status", "succeeded");

      if (!payments) return [];

      // Group by tenant and sum amounts
      const tenantVolumes = payments.reduce((acc: any, payment: any) => {
        const tenantId = payment.tenant_id;
        const tenantName = payment.tenants?.name || "Unknown";
        
        if (!acc[tenantId]) {
          acc[tenantId] = {
            tenant_id: tenantId,
            tenant_name: tenantName,
            total_volume: 0,
            transaction_count: 0,
          };
        }
        
        acc[tenantId].total_volume += payment.amount;
        acc[tenantId].transaction_count += 1;
        
        return acc;
      }, {});

      // Convert to array, sort, and take top 5
      const sorted = Object.values(tenantVolumes)
        .sort((a: any, b: any) => b.total_volume - a.total_volume)
        .slice(0, 5)
        .map((t: any, index) => ({
          ...t,
          rank: index + 1,
          total_volume_thb: (t.total_volume / 100).toFixed(2),
        }));

      return sorted;
    },
  });

  const chartColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

  const quickLinks = [
    { title: "จัดการพาร์ทเนอร์", url: "/platform/partners", icon: Users, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
    { title: "Providers", url: "/platform/providers", icon: KeyRound, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
    { title: "Status Monitor", url: "/platform/status", icon: Activity, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/30" },
    { title: "Security", url: "/platform/security", icon: Shield, color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/30" },
  ];

  return (
    <main className="w-full bg-white min-h-screen">
      <header className="px-6 pt-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-medium text-black tracking-tight">Platform Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">ภาพรวมระบบและกิจกรรมล่าสุด</p>
      </header>

      {/* KPI Cards */}
      <section className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-gray-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 uppercase tracking-wider">Shareholders</CardTitle>
            <Wallet className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            {loadingShareholders ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-black">{shareholdersCount}</div>
            )}
            <p className="text-xs text-gray-500 mt-1">Active shareholders</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 uppercase tracking-wider">Tenants</CardTitle>
            <Building2 className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            {loadingTenants ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-3xl font-bold text-black">{tenantsData?.total}</div>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="text-black font-semibold">{tenantsData?.active}</span> active
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 uppercase tracking-wider">Providers</CardTitle>
            <KeyRound className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            {loadingProviders ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-black">{providersCount}</div>
            )}
            <p className="text-xs text-gray-500 mt-1">Configured providers</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 uppercase tracking-wider">System Health</CardTitle>
            <Activity className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-black" />
              <span className="text-xl font-semibold text-black">Operational</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">All systems running</p>
          </CardContent>
        </Card>
      </section>

      {/* Quick Links */}
      <section className="px-6 pb-4">
        <h2 className="text-lg font-medium mb-3 text-black tracking-tight">Quick Access</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Button
              key={link.url}
              asChild
              variant="outline"
              className="h-auto p-4 justify-start border-gray-300 bg-white text-black hover:bg-gray-50 transition-all"
            >
              <Link to={link.url}>
                <div className="bg-white border border-gray-200 p-2 rounded-lg mr-3">
                  <link.icon className="h-5 w-5 text-gray-700" />
                </div>
                <span className="flex-1 text-left font-medium">{link.title}</span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>
            </Button>
          ))}
        </div>
      </section>

      {/* Top Tenants by Volume */}
      <section className="px-6 pb-4">
        <Card className="border border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black font-medium tracking-tight">
              <Trophy className="h-5 w-5 text-gray-700" />
              Top 5 Tenants (This Month)
            </CardTitle>
            <CardDescription className="text-gray-600">Tenants with highest transaction volume</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTopTenants ? (
              <div className="space-y-4">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[150px] w-full" />
              </div>
            ) : topTenants && topTenants.length > 0 ? (
              <div className="space-y-6">
                {/* Bar Chart */}
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topTenants} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="tenant_name" 
                        angle={-15}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: any) => [`฿${(value / 100).toLocaleString()}`, "Volume"]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Bar dataKey="total_volume" radius={[8, 8, 0, 0]}>
                        {topTenants.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Table */}
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 font-semibold text-black text-xs uppercase tracking-wider">Rank</th>
                        <th className="text-left p-3 font-semibold text-black text-xs uppercase tracking-wider">Tenant</th>
                        <th className="text-right p-3 font-semibold text-black text-xs uppercase tracking-wider">Transactions</th>
                        <th className="text-right p-3 font-semibold text-black text-xs uppercase tracking-wider">Volume (THB)</th>
                      </tr>
                    </thead>
                    <tbody>
                {topTenants.map((tenant: any, index: number) => (
                  <tr 
                    key={tenant.tenant_id} 
                    className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-3">
                      <Link 
                        to={`/admin/tenants/${tenant.tenant_id}`}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-black text-white font-bold text-xs"
                        >
                          {tenant.rank}
                        </div>
                        {tenant.rank === 1 && <Trophy className="h-4 w-4 text-gray-700" />}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link 
                        to={`/admin/tenants/${tenant.tenant_id}`}
                        className="font-medium text-black hover:text-gray-700 transition-colors"
                      >
                        {tenant.tenant_name}
                      </Link>
                    </td>
                    <td className="p-3 text-right">
                      <Badge variant="outline" className="bg-white text-black border-gray-300">{tenant.transaction_count}</Badge>
                    </td>
                    <td className="p-3 text-right font-semibold text-black">
                      ฿{Number(tenant.total_volume_thb).toLocaleString()}
                    </td>
                  </tr>
                ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No transaction data for this month</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent Activities & Audit Logs */}
      <section className="px-6 pb-6 grid gap-6 lg:grid-cols-2">
        {/* Recent Admin Activities */}
        <Card className="border border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black font-medium tracking-tight">
              <Activity className="h-5 w-5 text-gray-700" />
              Admin Activities
            </CardTitle>
            <CardDescription className="text-gray-600">กิจกรรมล่าสุดของผู้ดูแลระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivities ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentActivities && recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                    <div className="p-2 rounded-full bg-gray-100">
                      <Shield className="h-4 w-4 text-gray-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-black">{activity.action}</span>
                        {activity.profiles && (
                          <Badge variant="outline" className="text-xs bg-white text-black border-gray-300">
                            {activity.profiles.public_id}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {format(new Date(activity.created_at), "MMM dd, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">ไม่มีกิจกรรมล่าสุด</p>
            )}
            <Button asChild variant="outline" className="w-full mt-4 border-gray-300 bg-white text-black hover:bg-gray-50">
              <Link to="/platform/audit">
                View All Activities <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Audit Logs */}
        <Card className="border border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black font-medium tracking-tight">
              <Clock className="h-5 w-5 text-gray-700" />
              Audit Trail
            </CardTitle>
            <CardDescription className="text-gray-600">บันทึกการเปลี่ยนแปลงระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAudits ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentAudits && recentAudits.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentAudits.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-2 p-2 rounded border-l-2 border-l-primary/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <Badge variant="secondary" className="text-xs min-w-[80px] justify-center">
                      {log.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{log.target || "System"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">ไม่มีบันทึกล่าสุด</p>
            )}
            <Button asChild variant="ghost" className="w-full mt-4">
              <Link to="/platform/audit">
                View Full Audit Log <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
