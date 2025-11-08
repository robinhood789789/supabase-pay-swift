import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

interface Settlement {
  id: string;
  tenant_id: string;
  provider: string;
  cycle: string;
  net_amount: number;
  fees: number;
  paid_out_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SettlementDetailsDrawerProps {
  settlement: Settlement | null;
  open: boolean;
  onClose: () => void;
}

export const SettlementDetailsDrawer = ({ settlement, open, onClose }: SettlementDetailsDrawerProps) => {
  const { t } = useI18n();

  // Fetch related payments
  const { data: payments = [] } = useQuery({
    queryKey: ["settlement-payments", settlement?.id],
    queryFn: async () => {
      if (!settlement?.id) return [];
      
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("settlement_id", settlement.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!settlement?.id && open,
  });

  if (!settlement) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const grossAmount = settlement.net_amount + settlement.fees;
  const isPaid = !!settlement.paid_out_at;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('settlements.details')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Amount Summary */}
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('settlements.grossAmount')}</span>
              <span className="text-lg font-semibold">
                {(grossAmount / 100).toLocaleString()} THB
              </span>
            </div>
            <div className="flex items-center justify-between text-destructive">
              <span className="text-sm">{t('settlements.fees')}</span>
              <span className="text-sm font-medium">
                -{(settlement.fees / 100).toLocaleString()} THB
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium">{t('settlements.netAmount')}</span>
              <span className="text-2xl font-bold">
                {(settlement.net_amount / 100).toLocaleString()} THB
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('settlements.status')}</span>
            <Badge variant={isPaid ? "default" : "secondary"}>
              {isPaid ? t('settlements.paid') : t('settlements.pending')}
            </Badge>
          </div>

          {/* Settlement Details */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('settlements.id')}</span>
              <div className="flex items-center gap-2">
                <code className="text-xs">{settlement.id.slice(0, 8)}...</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(settlement.id, "Settlement ID")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('settlements.provider')}</span>
              <span className="text-sm font-medium">{settlement.provider}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('settlements.cycle')}</span>
              <span className="text-sm font-medium">{settlement.cycle}</span>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('settlements.created')}</span>
              <span className="text-sm">{format(new Date(settlement.created_at), "PPp")}</span>
            </div>

            {settlement.paid_out_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('settlements.paidOut')}</span>
                <span className="text-sm">{format(new Date(settlement.paid_out_at), "PPp")}</span>
              </div>
            )}
          </div>

          {/* Related Payments */}
          {payments.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <span className="text-sm font-medium">
                {t('settlements.relatedPayments')} ({payments.length})
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {payments.map((payment: any) => (
                  <div key={payment.id} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                    <div className="flex-1">
                      <div className="font-mono">{payment.id.slice(0, 8)}...</div>
                      <div className="text-muted-foreground">
                        {format(new Date(payment.created_at), "PP")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {(payment.amount / 100).toLocaleString()} {payment.currency.toUpperCase()}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
