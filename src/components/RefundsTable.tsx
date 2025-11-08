import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export const RefundsTable = () => {
  const { activeTenantId } = useTenantSwitcher();
  const { t } = useI18n();
  
  const [filters, setFilters] = useState({
    status: "all",
    reference: "",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
  });

  const { data: refunds, isLoading } = useQuery({
    queryKey: ["refunds", activeTenantId, filters],
    queryFn: async () => {
      if (!activeTenantId) return [];

      let query = supabase
        .from("refunds")
        .select(`
          *,
          payments (
            amount,
            currency,
            provider_payment_id,
            metadata
          )
        `)
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });

      if (filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded": return "default";
      case "pending": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const filteredRefunds = refunds?.filter(refund => {
    if (!filters.reference) return true;
    const searchTerm = filters.reference.toLowerCase();
    return (
      refund.id.toLowerCase().includes(searchTerm) ||
      refund.provider_refund_id?.toLowerCase().includes(searchTerm) ||
      refund.reason?.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger>
            <SelectValue placeholder={t('common.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('refunds.allStatus')}</SelectItem>
            <SelectItem value="pending">{t('refunds.pending')}</SelectItem>
            <SelectItem value="succeeded">{t('refunds.succeeded')}</SelectItem>
            <SelectItem value="failed">{t('refunds.failed')}</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn(!filters.dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? format(filters.dateFrom, "PPP") : t('refunds.fromDate')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => setFilters({ ...filters, dateFrom: date })}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn(!filters.dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? format(filters.dateTo, "PPP") : t('refunds.toDate')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => setFilters({ ...filters, dateTo: date })}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Input
          placeholder={t('refunds.searchPlaceholder')}
          value={filters.reference}
          onChange={(e) => setFilters({ ...filters, reference: e.target.value })}
        />
      </div>

      {!filteredRefunds || filteredRefunds.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">{t('refunds.noRefunds')}</p>
          <p className="text-sm text-muted-foreground">{t('refunds.noRefundsDesc')}</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.amount')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('refunds.reason')}</TableHead>
                <TableHead>{t('refunds.providerId')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead>{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRefunds.map((refund) => (
                <TableRow key={refund.id}>
                  <TableCell className="font-medium">
                    {(refund.amount / 100).toLocaleString()} {(refund.payments as any)?.currency?.toUpperCase()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(refund.status)}>{refund.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={refund.reason || "-"}>
                      {refund.reason || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={refund.provider_refund_id || "-"}>
                      {refund.provider_refund_id || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(refund.created_at), "PPp")}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a 
                        href={`/payments?highlight=${refund.payment_id}`}
                        className="gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {t('refunds.viewPayment')}
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
