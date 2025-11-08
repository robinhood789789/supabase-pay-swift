import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  CreditCard,
  CheckCircle,
  Clock,
  DollarSign,
  Activity,
  XCircle,
} from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

export default function PlatformTenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  // Fetch tenant info
  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ["tenant-detail", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch payment statistics
  const { data: paymentStats, isLoading: loadingStats } = useQuery({
    queryKey: ["tenant-payment-stats", tenantId],
    queryFn: async () => {
      const startDate = startOfMonth(new Date());
      
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, status, method, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", startDate.toISOString());

      if (!payments) return null;

      const total = payments.length;
      const succeeded = payments.filter(p => p.status === "succeeded").length;
      const failed = payments.filter(p => p.status === "failed").length;
      const pending = payments.filter(p => p.status === "pending").length;
      const totalVolume = payments
        .filter(p => p.status === "succeeded")
        .reduce((sum, p) => sum + p.amount, 0);
      const avgAmount = succeeded > 0 ? totalVolume / succeeded : 0;

      // Payment methods breakdown
      const methodsMap = payments.reduce((acc: any, p) => {
        const method = p.method || "unknown";
        if (!acc[method]) {
          acc[method] = { count: 0, volume: 0 };
        }
        acc[method].count += 1;
        if (p.status === "succeeded") {
          acc[method].volume += p.amount;
        }
        return acc;
      }, {});

      const methods = Object.entries(methodsMap).map(([name, data]: [string, any]) => ({
        name: name.toUpperCase(),
        count: data.count,
        volume: data.volume / 100,
      }));

      return {
        total,
        succeeded,
        failed,
        pending,
        totalVolume: totalVolume / 100,
        avgAmount: avgAmount / 100,
        successRate: total > 0 ? (succeeded / total) * 100 : 0,
        methods,
      };
    },
    enabled: !!tenantId,
  });

  // Fetch recent transactions
  const { data: recentTransactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["tenant-recent-transactions", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch transaction timeline (daily aggregates for last 30 days)
  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["tenant-timeline", tenantId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data } = await supabase
        .from("payments")
        .select("amount, status, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .eq("status", "succeeded");

      if (!data) return [];

      // Group by date
      const dailyMap = data.reduce((acc: any, payment) => {
        const date = format(new Date(payment.created_at), "MMM dd");
        if (!acc[date]) {
          acc[date] = { date, volume: 0, count: 0 };
        }
        acc[date].volume += payment.amount / 100;
        acc[date].count += 1;
        return acc;
      }, {});

      return Object.values(dailyMap).slice(-14); // Last 14 days
    },
    enabled: !!tenantId,
  });

  const statusColors = {
    succeeded: "#10b981",
    failed: "#ef4444",
    pending: "#f59e0b",
  };

  const statusData = paymentStats ? [
    { name: "Succeeded", value: paymentStats.succeeded, color: statusColors.succeeded },
    { name: "Failed", value: paymentStats.failed, color: statusColors.failed },
    { name: "Pending", value: paymentStats.pending, color: statusColors.pending },
  ].filter(d => d.value > 0) : [];

  const methodColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

  if (loadingTenant) {
    return (
      <div className="p-6">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Tenant not found</p>
            <Button onClick={() => navigate("/admin/dashboard")} className="mt-4 mx-auto block">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/admin/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{tenant.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Status: <Badge variant={tenant.status === "active" ? "default" : "secondary"}>{tenant.status}</Badge>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <DollarSign className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">
                  ฿{paymentStats?.totalVolume.toLocaleString() || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  {paymentStats?.successRate.toFixed(1)}%
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {paymentStats?.succeeded}/{paymentStats?.total} transactions
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Activity className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-purple-600">
                  {paymentStats?.total || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Amount</CardTitle>
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-amber-600">
                  ฿{paymentStats?.avgAmount.toLocaleString() || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Charts Section */}
      <section className="px-6 pb-6 grid gap-6 lg:grid-cols-2">
        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
            <CardDescription>Breakdown by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-[300px]" />
            ) : paymentStats?.methods && paymentStats.methods.length > 0 ? (
              <div className="space-y-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentStats.methods}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {paymentStats.methods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={methodColors[index % methodColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any, name, props) => [
                          `${value} transactions (฿${props.payload.volume.toLocaleString()})`,
                          props.payload.name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {paymentStats.methods.map((method, index) => (
                    <div key={method.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: methodColors[index % methodColors.length] }}
                        />
                        <span>{method.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {method.count} tx • ฿{method.volume.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No payment methods data</p>
            )}
          </CardContent>
        </Card>

        {/* Transaction Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Transaction Status
            </CardTitle>
            <CardDescription>Status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-[300px]" />
            ) : statusData.length > 0 ? (
              <div className="space-y-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium">Succeeded</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{paymentStats?.succeeded}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-medium">Failed</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{paymentStats?.failed}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-medium">Pending</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600">{paymentStats?.pending}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No status data</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Transaction Timeline */}
      <section className="px-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Transaction Timeline
            </CardTitle>
            <CardDescription>Last 14 days activity</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTimeline ? (
              <Skeleton className="h-[250px]" />
            ) : timeline && timeline.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`฿${Number(value).toLocaleString()}`, "Volume"]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="volume" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No timeline data</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent Transactions Table */}
      <section className="px-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Last 20 transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTransactions ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : recentTransactions && recentTransactions.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-semibold">Date</th>
                        <th className="text-left p-3 font-semibold">Method</th>
                        <th className="text-right p-3 font-semibold">Amount</th>
                        <th className="text-center p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((tx: any) => (
                        <tr key={tx.id} className="border-t hover:bg-muted/50 transition-colors">
                          <td className="p-3">
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), "MMM dd, yyyy")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), "HH:mm:ss")}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{tx.method || "N/A"}</Badge>
                          </td>
                          <td className="p-3 text-right font-semibold">
                            ฿{(tx.amount / 100).toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <Badge 
                              variant={
                                tx.status === "succeeded" ? "default" :
                                tx.status === "failed" ? "destructive" :
                                "secondary"
                              }
                            >
                              {tx.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No recent transactions</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
