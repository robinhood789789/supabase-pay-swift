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
import { Card, CardContent } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
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
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ["settlement-transfers", activeTenantId, statusFilter, providerFilter, searchQuery, dateFrom, dateTo],
    queryFn: async () => {
      if (!activeTenantId) return [];

      let query: any = supabase
        .from("settlement_transfers" as any)
        .select("*")
        .order("created_at", { ascending: false });

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (providerFilter !== "all") {
        query = query.eq("sys_bank", providerFilter);
      }

      if (searchQuery) {
        query = query.or(`settlement_ref.ilike.%${searchQuery}%,tx_id.ilike.%${searchQuery}%,beneficiary_name.ilike.%${searchQuery}%`);
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
        ['Create At', 'Ref ID', 'TX ID', 'Client', 'Merchant', 'Name', 'Amount', 'Bank', 'Acc Num', 'Status', 'Sys Bank', 'Sys Acc Name', 'Ops Type'],
        ...settlements.map((s: any) => [
          s.created_at ? format(new Date(s.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
          s.settlement_ref || '',
          s.tx_id || '',
          s.client_code || '',
          s.merchant_code || '',
          s.beneficiary_name || '',
          s.amount || '',
          s.bank_name || '',
          s.account_number || '',
          s.status || '',
          s.sys_bank || '',
          s.sys_account_name || '',
          s.ops_type || ''
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement-transfers-${new Date().toISOString().split('T')[0]}.csv`;
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
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
              <TableHead className="font-semibold">Create At</TableHead>
              <TableHead className="font-semibold">Ref ID</TableHead>
              <TableHead className="font-semibold">TX ID</TableHead>
              <TableHead className="font-semibold">Client</TableHead>
              <TableHead className="font-semibold">Merchant</TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Bank</TableHead>
              <TableHead className="font-semibold">Acc Num</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Sys Bank</TableHead>
              <TableHead className="font-semibold">Sys Acc Name</TableHead>
              <TableHead className="font-semibold">Ops Type</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const totalCount = settlements.length;
              const totalPages = Math.ceil(totalCount / itemsPerPage);
              const paginatedSettlements = settlements.slice(
                (page - 1) * itemsPerPage,
                page * itemsPerPage
              );

              if (paginatedSettlements.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={14} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Wallet className="h-8 w-8 mb-2 opacity-50" />
                        <p className="font-medium">{t('settlements.noData')}</p>
                        <p className="text-xs">{t('settlements.noDataDesc')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              return paginatedSettlements.map((settlement: any) => {
                return (
                  <TableRow
                    key={settlement.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleRowClick(settlement)}
                  >
                    <TableCell className="font-mono text-xs">
                      {settlement.created_at ? format(new Date(settlement.created_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{settlement.settlement_ref || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{settlement.tx_id || '-'}</TableCell>
                    <TableCell className="text-xs">{settlement.client_code || '-'}</TableCell>
                    <TableCell className="text-xs">{settlement.merchant_code || '-'}</TableCell>
                    <TableCell className="text-sm">{settlement.beneficiary_name || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {settlement.amount ? new Intl.NumberFormat('th-TH').format(parseFloat(settlement.amount)) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {settlement.bank_code || settlement.bank_name || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{settlement.account_number || '-'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          settlement.status === 'completed' ? 'default' : 
                          settlement.status === 'pending' ? 'secondary' : 
                          settlement.status === 'failed' ? 'destructive' : 
                          'outline'
                        }
                      >
                        {settlement.status || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{settlement.sys_bank || '-'}</TableCell>
                    <TableCell className="text-xs">{settlement.sys_account_name || '-'}</TableCell>
                    <TableCell className="text-xs">{settlement.ops_type || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(settlement);
                      }}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              });
            })()}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {settlements.length > 0 && (() => {
        const totalCount = settlements.length;
        const totalPages = Math.ceil(totalCount / itemsPerPage);
        
        return totalPages > 1 ? (
          <Card className="border border-border shadow-soft bg-card">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
                {/* Items per page selector - Left */}
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-sm text-muted-foreground">แสดง</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setPage(1);
                  }}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">รายการ</span>
                </div>

                {/* Pagination - Center */}
                <Pagination className="justify-center">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={page === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    {totalPages > 5 && page < totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>

                {/* Page info - Right */}
                <div className="text-sm text-muted-foreground text-center sm:text-right">
                  หน้า {page} จาก {totalPages} ({totalCount} รายการทั้งหมด)
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null;
      })()}

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
