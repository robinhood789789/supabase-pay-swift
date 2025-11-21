import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { RequireTenant } from '@/components/RequireTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle, ShieldAlert, CheckCircle, XCircle, Eye, Filter, TrendingUp, AlertCircle } from 'lucide-react';
import { useTenantSwitcher } from '@/hooks/useTenantSwitcher';
import { toast } from 'sonner';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { formatDistanceToNow } from 'date-fns';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  event_count: number;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  metadata: any;
  created_at: string;
}

const SecurityAlerts = () => {
  const { activeTenantId } = useTenantSwitcher();
  const queryClient = useQueryClient();
  
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'acknowledge' | 'resolve' | 'false_positive' | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  // Fetch alerts
  const { data: queryResult, isLoading } = useQuery<{ data: SecurityAlert[], count: number }>({
    queryKey: ['security-alerts', activeTenantId, severityFilter, statusFilter, typeFilter, page, itemsPerPage],
    queryFn: async () => {
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('security_alerts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (activeTenantId) {
        query = query.eq('tenant_id', activeTenantId);
      }

      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('alert_type', typeFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!activeTenantId,
  });

  const alerts = queryResult?.data || [];
  const totalCount = queryResult?.count || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Filter alerts by search
  const filteredAlerts = alerts?.filter(alert => 
    alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    alert.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    alert.alert_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate statistics
  const stats = {
    total: alerts?.length || 0,
    open: alerts?.filter(a => a.status === 'open').length || 0,
    acknowledged: alerts?.filter(a => a.status === 'acknowledged').length || 0,
    resolved: alerts?.filter(a => a.status === 'resolved').length || 0,
    critical: alerts?.filter(a => a.severity === 'critical').length || 0,
    high: alerts?.filter(a => a.severity === 'high').length || 0,
    medium: alerts?.filter(a => a.severity === 'medium').length || 0,
  };

  // Prepare chart data
  const severityData = [
    { name: 'Critical', value: stats.critical, color: 'hsl(var(--destructive))' },
    { name: 'High', value: stats.high, color: '#f97316' },
    { name: 'Medium', value: stats.medium, color: '#eab308' },
  ].filter(d => d.value > 0);

  const statusData = [
    { name: 'Open', value: stats.open, color: 'hsl(var(--destructive))' },
    { name: 'Acknowledged', value: stats.acknowledged, color: '#eab308' },
    { name: 'Resolved', value: stats.resolved, color: '#22c55e' },
  ].filter(d => d.value > 0);

  // Trend data (last 7 days)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    
    const dayAlerts = alerts?.filter(a => {
      const alertDate = new Date(a.created_at).toISOString().split('T')[0];
      return alertDate === dateStr;
    }) || [];

    return {
      date: date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
      total: dayAlerts.length,
      critical: dayAlerts.filter(a => a.severity === 'critical').length,
      high: dayAlerts.filter(a => a.severity === 'high').length,
    };
  });

  // Handle alert action
  const handleActionMutation = useMutation({
    mutationFn: async ({ alertId, action, notes }: { alertId: string; action: string; notes: string }) => {
      const { data, error } = await supabase.functions.invoke('security-alerts-manage', {
        body: { 
          alert_id: alertId,
          action,
          notes,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      toast.success('ดำเนินการสำเร็จ');
      setActionDialogOpen(false);
      setActionNotes('');
      setActionType(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    },
  });

  const handleAction = (alert: SecurityAlert, action: 'acknowledge' | 'resolve' | 'false_positive') => {
    setSelectedAlert(alert);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = () => {
    if (selectedAlert && actionType) {
      handleActionMutation.mutate({
        alertId: selectedAlert.id,
        action: actionType,
        notes: actionNotes,
      });
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      critical: { variant: 'destructive', icon: AlertTriangle },
      high: { variant: 'default', icon: AlertCircle },
      medium: { variant: 'secondary', icon: ShieldAlert },
      low: { variant: 'outline', icon: ShieldAlert },
    };
    const config = variants[severity] || variants.medium;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: 'destructive',
      acknowledged: 'secondary',
      resolved: 'default',
      false_positive: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const clearFilters = () => {
    setSeverityFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
  };

  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6 space-y-6 max-w-full">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-8 h-8" />
              Security Alerts Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              ติดตามและจัดการการแจ้งเตือนด้านความปลอดภัย
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>การแจ้งเตือนทั้งหมด</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  เปิด: {stats.open} | รับทราบ: {stats.acknowledged}
                </p>
              </CardContent>
            </Card>

            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardDescription>Critical</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{stats.critical}</div>
                <p className="text-xs text-muted-foreground mt-1">ต้องดำเนินการทันที</p>
              </CardContent>
            </Card>

            <Card className="border-orange-500/50 bg-orange-500/5">
              <CardHeader className="pb-2">
                <CardDescription>High</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{stats.high}</div>
                <p className="text-xs text-muted-foreground mt-1">ควรตรวจสอบโดยเร็ว</p>
              </CardContent>
            </Card>

            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardDescription>แก้ไขแล้ว</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{stats.resolved}</div>
                <p className="text-xs text-muted-foreground mt-1">จัดการเสร็จสิ้น</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  แนวโน้ม 7 วันที่ผ่านมา
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="critical" stroke="hsl(var(--destructive))" strokeWidth={2} name="Critical" />
                    <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} name="High" />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} name="ทั้งหมด" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">ตามระดับความรุนแรง</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={severityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {severityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">ตามสถานะ</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Alerts Table */}
          <Card>
            <CardHeader>
              <CardTitle>รายการแจ้งเตือน</CardTitle>
              <CardDescription>แสดง {filteredAlerts?.length || 0} จาก {stats.total} รายการ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>ค้นหา</Label>
                  <Input
                    placeholder="ค้นหาการแจ้งเตือน..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>ความรุนแรง</Label>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>สถานะ</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="acknowledged">Acknowledged</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="false_positive">False Positive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ประเภท</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="password_reset_spike_hourly">Reset Spike (Hourly)</SelectItem>
                      <SelectItem value="password_reset_spike_daily">Reset Spike (Daily)</SelectItem>
                      <SelectItem value="failed_login_threshold">Failed Login</SelectItem>
                      <SelectItem value="rate_limit_abuse">Rate Limit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(severityFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <Filter className="w-4 h-4 mr-2" />
                  ล้างตัวกรอง
                </Button>
              )}

              <ScrollArea className="h-[500px] border rounded-lg">
                {isLoading ? (
                  <div className="space-y-2 p-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : filteredAlerts && filteredAlerts.length > 0 ? (
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>ความรุนแรง</TableHead>
                        <TableHead>หัวข้อ</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>จำนวน</TableHead>
                        <TableHead>เวลา</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.map((alert) => (
                        <TableRow key={alert.id} className="hover:bg-muted/50">
                          <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                          <TableCell className="max-w-xs">
                            <p className="font-medium truncate">{alert.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{alert.description}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {alert.alert_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(alert.status)}</TableCell>
                          <TableCell>
                            <Badge>{alert.event_count}</Badge>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedAlert(alert);
                                  setDetailDialogOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {alert.status === 'open' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAction(alert, 'acknowledge')}
                                  >
                                    รับทราบ
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleAction(alert, 'resolve')}
                                  >
                                    แก้ไข
                                  </Button>
                                </>
                              )}
                              {alert.status === 'acknowledged' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAction(alert, 'resolve')}
                                >
                                  แก้ไข
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">ไม่พบการแจ้งเตือน</p>
                    <p className="text-sm mt-1">ไม่มีการแจ้งเตือนด้านความปลอดภัยในขณะนี้</p>
                  </div>
                )}
              </ScrollArea>

              {/* Pagination Controls */}
              {alerts && alerts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 mt-4 pt-4 border-t">
                  {/* Items per page selector - Left */}
                  <div className="flex items-center gap-2 justify-start">
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
                    หน้า {page} จาก {totalPages} ({totalCount} รายการทั้งหมด)
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail Dialog */}
          <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>รายละเอียดการแจ้งเตือน</DialogTitle>
                <DialogDescription>ข้อมูลเชิงลึกเกี่ยวกับการแจ้งเตือนนี้</DialogDescription>
              </DialogHeader>
              {selectedAlert && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">ความรุนแรง</Label>
                      <div className="mt-1">{getSeverityBadge(selectedAlert.severity)}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">สถานะ</Label>
                      <div className="mt-1">{getStatusBadge(selectedAlert.status)}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">ประเภท</Label>
                      <p className="mt-1 text-sm">{selectedAlert.alert_type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">จำนวนครั้ง</Label>
                      <p className="mt-1 text-sm font-bold">{selectedAlert.event_count}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">หัวข้อ</Label>
                    <p className="mt-1 text-sm font-medium">{selectedAlert.title}</p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">รายละเอียด</Label>
                    <p className="mt-1 text-sm">{selectedAlert.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">พบครั้งแรก</Label>
                      <p className="mt-1 text-sm">{new Date(selectedAlert.first_seen_at).toLocaleString('th-TH')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">พบครั้งล่าสุด</Label>
                      <p className="mt-1 text-sm">{new Date(selectedAlert.last_seen_at).toLocaleString('th-TH')}</p>
                    </div>
                  </div>

                  {selectedAlert.metadata && (
                    <div>
                      <Label className="text-muted-foreground">ข้อมูลเพิ่มเติม</Label>
                      <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(selectedAlert.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Action Dialog */}
          <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {actionType === 'acknowledge' && 'รับทราบการแจ้งเตือน'}
                  {actionType === 'resolve' && 'แก้ไขการแจ้งเตือน'}
                  {actionType === 'false_positive' && 'ทำเครื่องหมายว่าไม่ใช่ภัยคุกคาม'}
                </DialogTitle>
                <DialogDescription>
                  กรุณาเพิ่มหมายเหตุเพื่ออธิบายการดำเนินการของคุณ
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    placeholder="อธิบายการดำเนินการ..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
                    ยกเลิก
                  </Button>
                  <Button 
                    onClick={confirmAction}
                    disabled={handleActionMutation.isPending}
                  >
                    {handleActionMutation.isPending ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default SecurityAlerts;