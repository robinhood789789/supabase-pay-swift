import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Calendar, Wallet } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { SettlementDetailsDrawer } from "./SettlementDetailsDrawer";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const SettlementsTable = () => {
  const { t } = useI18n();
  const { activeTenantId } = useTenantSwitcher();
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ["settlements", activeTenantId, statusFilter, providerFilter, searchQuery, dateFrom, dateTo],
    queryFn: async () => {
      if (!activeTenantId) return [];

      let query = supabase
        .from("settlements")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });

      // Apply filters
      if (statusFilter === "paid") {
        query = query.not("paid_out_at", "is", null);
      } else if (statusFilter === "pending") {
        query = query.is("paid_out_at", null);
      }

      if (providerFilter !== "all") {
        query = query.eq("provider", providerFilter);
      }

      if (searchQuery) {
        query = query.or(`id.ilike.%${searchQuery}%,cycle.ilike.%${searchQuery}%`);
      }

      if (dateFrom) {
        query = query.gte("created_at", new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTenantId,
  });

  const handleExportCSV = async () => {
    try {
      const csv = [
        ['ID', 'Provider', 'Cycle', 'Gross Amount', 'Fees', 'Net Amount', 'Status', 'Paid Out', 'Created'],
        ...settlements.map((s: any) => [
          s.id,
          s.provider,
          s.cycle,
          (s.net_amount + s.fees) / 100,
          s.fees / 100,
          s.net_amount / 100,
          s.paid_out_at ? 'Paid' : 'Pending',
          s.paid_out_at || '',
          s.created_at
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlements-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t('settlements.exportSuccess'));
    } catch (error) {
      toast.error(t('settlements.exportError'));
    }
  };

  const handleRowClick = (settlement: any) => {
    setSelectedSettlement(settlement);
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              <Calendar className="inline h-3 w-3 mr-1" />
              {t('settlements.dateFrom')}
            </Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              <Calendar className="inline h-3 w-3 mr-1" />
              {t('settlements.dateTo')}
            </Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('settlements.status')}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('settlements.allStatus')}</SelectItem>
                <SelectItem value="paid">{t('settlements.paid')}</SelectItem>
                <SelectItem value="pending">{t('settlements.pending')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('settlements.provider')}</Label>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('settlements.allProviders')}</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="opn">OPN</SelectItem>
                <SelectItem value="kbank">KBank</SelectItem>
                <SelectItem value="twoc2p">2C2P</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('settlements.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Button onClick={handleExportCSV} variant="outline" size="default">
            <Download className="h-4 w-4 mr-2" />
            {t('settlements.export')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">{t('settlements.id')}</TableHead>
              <TableHead className="font-semibold">{t('settlements.provider')}</TableHead>
              <TableHead className="font-semibold">{t('settlements.cycle')}</TableHead>
              <TableHead className="text-right font-semibold">{t('settlements.grossAmount')}</TableHead>
              <TableHead className="text-right font-semibold">{t('settlements.fees')}</TableHead>
              <TableHead className="text-right font-semibold">{t('settlements.netAmount')}</TableHead>
              <TableHead className="font-semibold">{t('settlements.status')}</TableHead>
              <TableHead className="font-semibold">{t('settlements.created')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Wallet className="h-8 w-8 mb-2 opacity-50" />
                    <p className="font-medium">{t('settlements.noData')}</p>
                    <p className="text-xs">{t('settlements.noDataDesc')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              settlements.map((settlement: any) => {
                const grossAmount = settlement.net_amount + settlement.fees;
                const isPaid = !!settlement.paid_out_at;
                
                return (
                  <TableRow
                    key={settlement.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleRowClick(settlement)}
                  >
                    <TableCell className="font-mono text-xs">
                      {settlement.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <span className="font-medium capitalize">{settlement.provider}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{settlement.cycle}</TableCell>
                    <TableCell className="text-right font-medium">
                      ฿{(grossAmount / 100).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      -฿{(settlement.fees / 100).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      ฿{(settlement.net_amount / 100).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isPaid ? "default" : "secondary"} className="font-medium">
                        {isPaid ? t('settlements.paid') : t('settlements.pending')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(settlement.created_at), "PP")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <SettlementDetailsDrawer
        settlement={selectedSettlement}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedSettlement(null);
        }}
      />
    </div>
  );
};
