import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Activity, Filter, Download, RefreshCw, Eye, Shield, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { use2FAChallenge } from '@/hooks/use2FAChallenge';
import { TwoFactorChallenge } from '@/components/security/TwoFactorChallenge';

interface AuditLog {
  id: string;
  action: string;
  actor_user_id: string | null;
  tenant_id: string | null;
  target: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  before: any;
  after: any;
}

export default function PlatformAudit() {
  const { user, isSuperAdmin, loading } = useAuth();
  const { isOpen: mfaOpen, setIsOpen: setMfaOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [actorFilter, setActorFilter] = useState<string>('');
  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Log page access
  useEffect(() => {
    if (user && isSuperAdmin) {
      supabase.from("audit_logs").insert({
        action: "super_admin.audit.viewed",
        actor_user_id: user.id,
        ip: null,
        user_agent: navigator.userAgent,
      });
    }
  }, [user, isSuperAdmin]);

  const { data: logs, isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ['platform-audit-logs', actionFilter, dateFromFilter, dateToFilter, actorFilter, tenantFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (actionFilter && actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      if (actorFilter) {
        query = query.ilike('actor_user_id', `%${actorFilter}%`);
      }

      if (tenantFilter) {
        query = query.ilike('tenant_id', `%${tenantFilter}%`);
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
    enabled: isSuperAdmin,
  });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('create') || action.includes('invite')) return 'default';
    if (action.includes('update')) return 'secondary';
    if (action.includes('delete') || action.includes('revoke')) return 'destructive';
    return 'outline';
  };

  const handleExportLarge = async () => {
    if (!logs || logs.length === 0) {
      toast.error('ไม่มีข้อมูลให้ส่งออก');
      return;
    }

    const performExport = async () => {
      const csv = [
        ['Action', 'Tenant ID', 'Target', 'Actor ID', 'IP Address', 'User Agent', 'Date'].join(','),
        ...logs.map(log => [
          log.action,
          log.tenant_id || '-',
          log.target || '-',
          log.actor_user_id || 'System',
          log.ip || '-',
          `"${log.user_agent?.replace(/"/g, '""') || '-'}"`,
          new Date(log.created_at).toISOString()
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const checksum = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const checksumHex = Array.from(new Uint8Array(checksum))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platform-audit-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Log export action
      await supabase.from("audit_logs").insert({
        action: "super_admin.audit.exported",
        actor_user_id: user?.id,
        ip: null,
        user_agent: navigator.userAgent,
        after: {
          row_count: logs.length,
          checksum: checksumHex,
        },
      });

      toast.success(`ส่งออกสำเร็จ SHA-256: ${checksumHex.slice(0, 16)}...`);
    };

    // Require MFA for large exports (>5000 rows)
    if (logs.length > 5000) {
      checkAndChallenge(performExport);
    } else {
      await performExport();
    }
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
    setTenantFilter('');
  };

  // Redact sensitive fields for display
  const redactSensitive = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const redacted = { ...obj };
    const sensitiveKeys = ['secret', 'password', 'token', 'key', 'hashed_secret', 'totp_secret'];
    
    for (const key in redacted) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = redactSensitive(redacted[key]);
      }
    }
    
    return redacted;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <TwoFactorChallenge
        open={mfaOpen}
        onOpenChange={setMfaOpen}
        onSuccess={onSuccess}
      />
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Platform Audit Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Cross-tenant activity monitoring and forensics
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Activity Log
                </CardTitle>
                <CardDescription>
                  Platform-wide audit trail with advanced filtering
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportLarge}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="tenant.create">Tenant Created</SelectItem>
                    <SelectItem value="user.invite">User Invited</SelectItem>
                    <SelectItem value="approval.create">Approval Created</SelectItem>
                    <SelectItem value="approval.decide">Approval Decided</SelectItem>
                    <SelectItem value="export.created">Export Created</SelectItem>
                    <SelectItem value="api_key.create">API Key Created</SelectItem>
                    <SelectItem value="refund.create">Refund Created</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tenant ID</Label>
                <Input
                  placeholder="Filter by tenant..."
                  value={tenantFilter}
                  onChange={(e) => setTenantFilter(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Actor ID</Label>
                <Input
                  placeholder="Filter by user..."
                  value={actorFilter}
                  onChange={(e) => setActorFilter(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Date From</Label>
                <Input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Date To</Label>
                <Input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                />
              </div>
            </div>

            {(actionFilter !== 'all' || dateFromFilter || dateToFilter || actorFilter || tenantFilter) && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
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
                      <TableHead>Action</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Details</TableHead>
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
                          {log.tenant_id?.slice(0, 8) || '-'}
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
                          {new Date(log.created_at).toLocaleString()}
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
                  <p className="text-lg font-medium">No activities found</p>
                  <p className="text-sm mt-1">Try adjusting your filters</p>
                </div>
              )}
            </ScrollArea>

            {logs && logs.length > 0 && (
              <div className="text-sm text-muted-foreground text-center pt-2">
                Showing {logs.length} results
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Activity Details</DialogTitle>
              <DialogDescription>
                Detailed information with sensitive data redacted
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Action</Label>
                    <div className="mt-1">
                      <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                        {selectedLog.action}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date</Label>
                    <p className="mt-1 text-sm">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tenant ID</Label>
                    <p className="mt-1 font-mono text-sm">
                      {selectedLog.tenant_id || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Actor</Label>
                    <p className="mt-1 font-mono text-sm">
                      {selectedLog.actor_user_id || <span className="italic">System</span>}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Target</Label>
                    <p className="mt-1 font-mono text-sm">
                      {selectedLog.target || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">IP Address</Label>
                    <p className="mt-1 text-sm">{selectedLog.ip || '-'}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <p className="mt-1 text-sm break-all">
                    {selectedLog.user_agent || '-'}
                  </p>
                </div>

                {selectedLog.before && (
                  <div>
                    <Label className="text-muted-foreground">Before State</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(redactSensitive(selectedLog.before), null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.after && (
                  <div>
                    <Label className="text-muted-foreground">After State</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(redactSensitive(selectedLog.after), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
