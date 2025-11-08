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
} from "lucide-react";
import { format } from "date-fns";

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

  const quickLinks = [
    { title: "จัดการพาร์ทเนอร์", url: "/platform/partners", icon: Users, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
    { title: "Providers", url: "/platform/providers", icon: KeyRound, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
    { title: "Status Monitor", url: "/platform/status", icon: Activity, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/30" },
    { title: "Security", url: "/platform/security", icon: Shield, color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/30" },
  ];

  return (
    <main className="w-full">
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-3xl font-bold text-foreground">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">ภาพรวมระบบและกิจกรรมล่าสุด</p>
      </header>

      {/* KPI Cards */}
      <section className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Shareholders</CardTitle>
            <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            {loadingShareholders ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{shareholdersCount}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Active shareholders</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">Tenants</CardTitle>
            <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            {loadingTenants ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{tenantsData?.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-600 dark:text-green-400 font-semibold">{tenantsData?.active}</span> active
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Providers</CardTitle>
            <KeyRound className="h-5 w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            {loadingProviders ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{providersCount}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Configured providers</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">System Health</CardTitle>
            <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <span className="text-xl font-semibold text-green-600 dark:text-green-400">Operational</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">All systems running</p>
          </CardContent>
        </Card>
      </section>

      {/* Quick Links */}
      <section className="px-6 pb-4">
        <h2 className="text-lg font-semibold mb-3 text-foreground">Quick Access</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Button
              key={link.url}
              asChild
              variant="outline"
              className="h-auto p-4 justify-start hover:shadow-md transition-all"
            >
              <Link to={link.url}>
                <div className={`${link.bgColor} p-2 rounded-lg mr-3`}>
                  <link.icon className={`h-5 w-5 ${link.color}`} />
                </div>
                <span className="flex-1 text-left font-medium">{link.title}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
          ))}
        </div>
      </section>

      {/* Recent Activities & Audit Logs */}
      <section className="px-6 pb-6 grid gap-6 lg:grid-cols-2">
        {/* Recent Admin Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Admin Activities
            </CardTitle>
            <CardDescription>กิจกรรมล่าสุดของผู้ดูแลระบบ</CardDescription>
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
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{activity.action}</span>
                        {activity.profiles && (
                          <Badge variant="outline" className="text-xs">
                            {activity.profiles.public_id}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), "MMM dd, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">ไม่มีกิจกรรมล่าสุด</p>
            )}
            <Button asChild variant="ghost" className="w-full mt-4">
              <Link to="/platform/audit">
                View All Activities <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Audit Trail
            </CardTitle>
            <CardDescription>บันทึกการเปลี่ยนแปลงระบบ</CardDescription>
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
