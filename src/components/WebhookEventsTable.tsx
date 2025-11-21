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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, Eye, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";

export const WebhookEventsTable = () => {
  const { activeTenantId } = useTenantSwitcher();
  const { t } = useI18n();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  const [filters, setFilters] = useState({
    status: "all",
    provider: "all",
    eventType: "",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
  });

  const { data: queryResult, isLoading } = useQuery<{ data: any[], count: number }>({
    queryKey: ["webhook-events", activeTenantId, filters, page, itemsPerPage],
    queryFn: async () => {
      if (!activeTenantId) return { data: [], count: 0 };

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from("webhook_events")
        .select("*", { count: 'exact' })
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters.provider !== "all") {
        query = query.eq("provider", filters.provider);
      }

      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!activeTenantId,
  });

  const events = queryResult?.data || [];
  const totalCount = queryResult?.count || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "default";
      case "queued": return "secondary";
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

  const filteredEvents = events?.filter(event => {
    if (!filters.eventType) return true;
    return event.event_type?.toLowerCase().includes(filters.eventType.toLowerCase());
  });

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger>
              <SelectValue placeholder={t('common.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('webhookEvents.allStatus')}</SelectItem>
              <SelectItem value="queued">{t('webhookEvents.queued')}</SelectItem>
              <SelectItem value="delivered">{t('webhookEvents.delivered')}</SelectItem>
              <SelectItem value="failed">{t('webhookEvents.failed')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.provider} onValueChange={(v) => setFilters({ ...filters, provider: v })}>
            <SelectTrigger>
              <SelectValue placeholder={t('webhookEvents.provider')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('webhookEvents.allProviders')}</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="opn">OPN</SelectItem>
              <SelectItem value="kbank">KBank</SelectItem>
              <SelectItem value="twoc2p">2C2P</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn(!filters.dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(filters.dateFrom, "PPP") : t('webhookEvents.fromDate')}
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
                {filters.dateTo ? format(filters.dateTo, "PPP") : t('webhookEvents.toDate')}
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
            placeholder={t('webhookEvents.searchPlaceholder')}
            value={filters.eventType}
            onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
          />
        </div>

        {!filteredEvents || filteredEvents.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground mb-4">{t('webhookEvents.noEvents')}</p>
            <p className="text-sm text-muted-foreground">{t('webhookEvents.noEventsDesc')}</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('webhookEvents.eventType')}</TableHead>
                  <TableHead>{t('webhookEvents.provider')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('webhookEvents.attempts')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-xs truncate" title={event.event_type || "-"}>
                        {event.event_type || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.provider || "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(event.status)}>{event.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{event.attempts || 0}</span>
                        {event.status === "failed" && event.last_error && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(event.created_at), "PPp")}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedEvent(event);
                          setDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {t('common.view')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredEvents && filteredEvents.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
                {/* Items per page selector - Left */}
                <div className="flex items-center gap-2 justify-start">
                  <span className="text-sm text-muted-foreground">Show</span>
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
                  <span className="text-sm text-muted-foreground">items per page</span>
                </div>

                {/* Pagination - Center */}
                <div className="flex justify-center">
                  <Pagination>
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
                </div>

                {/* Page info - Right */}
                <div className="text-sm text-muted-foreground text-right">
                  Page {page} of {totalPages} ({totalCount} total items)
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('webhookEvents.eventDetails')}</DialogTitle>
            <DialogDescription>
              {selectedEvent?.event_type} - {selectedEvent?.provider}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('common.status')}</p>
                  <Badge variant={getStatusColor(selectedEvent.status)}>{selectedEvent.status}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('webhookEvents.attempts')}</p>
                  <p className="text-sm">{selectedEvent.attempts || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('common.date')}</p>
                  <p className="text-sm">{format(new Date(selectedEvent.created_at), "PPpp")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('webhookEvents.eventId')}</p>
                  <p className="text-xs font-mono truncate">{selectedEvent.id}</p>
                </div>
              </div>

              {selectedEvent.last_error && (
                <div>
                  <p className="text-sm font-medium text-destructive mb-2">{t('webhookEvents.error')}</p>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-xs font-mono text-destructive">{selectedEvent.last_error}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t('webhookEvents.payload')}</p>
                <ScrollArea className="h-[300px] w-full rounded-lg border bg-muted/50 p-4">
                  <pre className="text-xs">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
