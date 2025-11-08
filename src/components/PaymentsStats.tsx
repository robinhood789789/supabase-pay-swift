import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Clock, XCircle, CheckCircle } from "lucide-react";

export const PaymentsStats = () => {
  const { activeTenantId } = useTenantSwitcher();

  const { data: stats } = useQuery({
    queryKey: ["payment-stats", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return null;

      const { data: payments, error } = await supabase
        .from("payments")
        .select("amount, status")
        .eq("tenant_id", activeTenantId);

      if (error) throw error;

      const totalRevenue = payments
        .filter(p => p.status === "succeeded")
        .reduce((sum, p) => sum + p.amount, 0);

      const totalPayments = payments.length;
      const succeededCount = payments.filter(p => p.status === "succeeded").length;
      const pendingCount = payments.filter(p => p.status === "pending" || p.status === "processing").length;
      const failedCount = payments.filter(p => p.status === "failed" || p.status === "rejected").length;
      const successRate = totalPayments > 0 ? (succeededCount / totalPayments) * 100 : 0;

      return {
        totalRevenue,
        successRate,
        pendingCount,
        failedCount,
        succeededCount,
      };
    },
    enabled: !!activeTenantId,
  });

  const statsCards = [
    {
      title: "Total Revenue",
      value: stats ? `฿${(stats.totalRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "฿0.00",
      icon: DollarSign,
      iconColor: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Success Rate",
      value: stats ? `${stats.successRate.toFixed(1)}%` : "0%",
      icon: TrendingUp,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Successful Payments",
      value: stats?.succeededCount.toString() || "0",
      icon: CheckCircle,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      title: "Pending",
      value: stats?.pendingCount.toString() || "0",
      icon: Clock,
      iconColor: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950",
    },
    {
      title: "Failed",
      value: stats?.failedCount.toString() || "0",
      icon: XCircle,
      iconColor: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {statsCards.map((stat) => (
        <Card key={stat.title} className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
