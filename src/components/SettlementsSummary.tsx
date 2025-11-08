import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, DollarSign, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SettlementsSummaryProps {
  settlements: any[];
}

export const SettlementsSummary = ({ settlements }: SettlementsSummaryProps) => {
  const { t } = useI18n();

  // Calculate summary stats
  const totalCount = settlements.length;
  const paidCount = settlements.filter(s => s.paid_out_at).length;
  const pendingCount = settlements.filter(s => !s.paid_out_at).length;
  
  const totalGross = settlements.reduce((sum, s) => sum + (s.net_amount + s.fees), 0);
  const totalFees = settlements.reduce((sum, s) => sum + s.fees, 0);
  const totalNet = settlements.reduce((sum, s) => sum + s.net_amount, 0);

  const summaryCards = [
    {
      title: t('settlements.totalSettlements'),
      value: totalCount,
      subtitle: `${paidCount} ${t('settlements.paid')}, ${pendingCount} ${t('settlements.pending')}`,
      icon: Wallet,
      color: "text-primary"
    },
    {
      title: t('settlements.totalGross'),
      value: `฿${(totalGross / 100).toLocaleString()}`,
      subtitle: t('settlements.beforeFees'),
      icon: TrendingUp,
      color: "text-green-600"
    },
    {
      title: t('settlements.totalFees'),
      value: `฿${(totalFees / 100).toLocaleString()}`,
      subtitle: t('settlements.processingFees'),
      icon: DollarSign,
      color: "text-orange-600"
    },
    {
      title: t('settlements.totalNet'),
      value: `฿${(totalNet / 100).toLocaleString()}`,
      subtitle: t('settlements.afterFees'),
      icon: Clock,
      color: "text-blue-600"
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {summaryCards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
