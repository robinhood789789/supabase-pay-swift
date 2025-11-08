import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Activity, Filter, Download, RefreshCw, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface AuditLog {
  id: string;
  action: string;
  actor_user_id: string | null;
  target: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  before: any;
  after: any;
}

export function ActivityLog({ tenantId }: { tenantId: string }) {
  const { t, formatDate } = useI18n();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [actorFilter, setActorFilter] = useState<string>('');
  const [ipFilter, setIpFilter] = useState<string>('');
  const [targetFilter, setTargetFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: logs, isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', tenantId, actionFilter, dateFromFilter, dateToFilter, actorFilter, ipFilter, targetFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (actionFilter && actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      if (actorFilter) {
        query = query.ilike('actor_user_id', `%${actorFilter}%`);
      }

      if (ipFilter) {
        query = query.ilike('ip', `%${ipFilter}%`);
      }

      if (targetFilter) {
        query = query.ilike('target', `%${targetFilter}%`);
      }

      if (dateFromFilter) {
        const startOfDay = new Date(dateFromFilter);
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startOfDay.toISOString());
      }

      if (dateToFilter) {
        const endOfDay = new Date(dateToFilter);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('create') || action.includes('invite')) return 'default';
    if (action.includes('update')) return 'secondary';
    if (action.includes('delete') || action.includes('revoke')) return 'destructive';
    return 'outline';
  };

  const handleExport = async () => {
    if (!logs || logs.length === 0) {
      toast({
        title: t('activityLog.noDataToExport'),
        variant: "destructive"
      });
      return;
    }

    // For large exports, show checksum
    const csv = [
      ['Action', 'Target', 'Actor ID', 'IP Address', 'User Agent', 'Date'].join(','),
      ...logs.map(log => [
        log.action,
        log.target || '-',
        log.actor_user_id || 'System',
        log.ip || '-',
        `"${log.user_agent?.replace(/"/g, '""') || '-'}"`,
        new Date(log.created_at).toISOString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    
    // Generate checksum for large exports
    if (logs.length > 1000) {
      const checksum = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const checksumHex = Array.from(new Uint8Array(checksum))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      toast({
        title: t('activityLog.exportSuccess'),
        description: `SHA-256: ${checksumHex.slice(0, 16)}...`,
      });
    } else {
      toast({
        title: t('activityLog.exportSuccess'),
      });
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const clearFilters = () => {
    setActionFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setActorFilter('');
    setIpFilter('');
    setTargetFilter('');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                {t('activityLog.title')}
              </CardTitle>
              <CardDescription>
                {t('activityLog.description')}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('activityLog.refresh')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                {t('activityLog.export')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>{t('activityLog.action')}</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('activityLog.allActions')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('activityLog.allActions')}</SelectItem>
                  <SelectItem value="payment:create">{t('activityLog.paymentCreated')}</SelectItem>
                  <SelectItem value="payment:update">{t('activityLog.paymentUpdated')}</SelectItem>
                  <SelectItem value="refund:create">{t('activityLog.refundCreated')}</SelectItem>
                  <SelectItem value="link:create">{t('activityLog.linkCreated')}</SelectItem>
                  <SelectItem value="link:disable">{t('activityLog.linkDisabled')}</SelectItem>
                  <SelectItem value="user:invite">{t('activityLog.userInvited')}</SelectItem>
                  <SelectItem value="settings:update">{t('activityLog.settingsUpdated')}</SelectItem>
                  <SelectItem value="api_key:create">{t('activityLog.apiKeyCreated')}</SelectItem>
                  <SelectItem value="api_key:revoke">{t('activityLog.apiKeyRevoked')}</SelectItem>
                  <SelectItem value="webhook:create">{t('activityLog.webhookCreated')}</SelectItem>
                  <SelectItem value="webhook:update">{t('activityLog.webhookUpdated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('activityLog.dateFrom')}</Label>
              <Input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('activityLog.dateTo')}</Label>
              <Input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('activityLog.actorId')}</Label>
              <Input
                placeholder={t('activityLog.searchByUserId')}
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input
                placeholder="Filter by IP..."
                value={ipFilter}
                onChange={(e) => setIpFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Target</Label>
              <Input
                placeholder="Filter by target..."
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
              />
            </div>
          </div>

          {(actionFilter !== 'all' || dateFromFilter || dateToFilter || actorFilter || ipFilter || targetFilter) && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                <Filter className="w-4 h-4 mr-2" />
                {t('activityLog.clearFilters')}
              </Button>
            </div>
          )}

          <ScrollArea className="h-[600px] border rounded-lg">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : logs && logs.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>{t('activityLog.action')}</TableHead>
                    <TableHead>{t('activityLog.target')}</TableHead>
                    <TableHead>{t('activityLog.actor')}</TableHead>
                    <TableHead>{t('activityLog.ipAddress')}</TableHead>
                    <TableHead>{t('activityLog.date')}</TableHead>
                    <TableHead className="text-right">{t('activityLog.details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.target?.slice(0, 12) || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.actor_user_id?.slice(0, 12) || (
                          <span className="text-muted-foreground italic">System</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{log.ip || '-'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(new Date(log.created_at), 'datetime')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">{t('activityLog.noActivities')}</p>
                <p className="text-sm mt-1">{t('activityLog.tryAdjustingFilters')}</p>
              </div>
            )}
          </ScrollArea>

          {logs && logs.length > 0 && (
            <div className="text-sm text-muted-foreground text-center pt-2">
              {t('activityLog.showingResults', { count: logs.length })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('activityLog.activityDetails')}</DialogTitle>
            <DialogDescription>
              {t('activityLog.detailedInformation')}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t('activityLog.action')}</Label>
                  <div className="mt-1">
                    <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                      {selectedLog.action}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('activityLog.date')}</Label>
                  <p className="mt-1 text-sm">
                    {formatDate(new Date(selectedLog.created_at), 'datetime')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('activityLog.actor')}</Label>
                  <p className="mt-1 font-mono text-sm">
                    {selectedLog.actor_user_id || <span className="italic">System</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('activityLog.target')}</Label>
                  <p className="mt-1 font-mono text-sm">
                    {selectedLog.target || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('activityLog.ipAddress')}</Label>
                  <p className="mt-1 text-sm">{selectedLog.ip || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('activityLog.userAgent')}</Label>
                  <p className="mt-1 text-sm truncate" title={selectedLog.user_agent || '-'}>
                    {selectedLog.user_agent || '-'}
                  </p>
                </div>
              </div>

              {selectedLog.before && (
                <div>
                  <Label className="text-muted-foreground">{t('activityLog.beforeState')}</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.before, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.after && (
                <div>
                  <Label className="text-muted-foreground">{t('activityLog.afterState')}</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
