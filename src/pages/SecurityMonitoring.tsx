import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle, Activity, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const SecurityMonitoring = () => {
  const { events, alerts, metrics, loading, updateAlert, refresh } = useSecurityMonitoring();
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  const getSeverityColor = (severity: string): 'default' | 'destructive' | 'secondary' => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'destructive';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string): 'default' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'open':
        return 'destructive';
      case 'resolved':
      case 'false_positive':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const todayMetrics = metrics[0];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Security Monitoring</h1>
              <p className="text-muted-foreground">
                Monitor security events and alerts in real-time
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-[60px]" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Security Monitoring</h1>
            <p className="text-muted-foreground">
              Monitor security events and alerts in real-time
            </p>
          </div>
          <Button onClick={refresh} variant="outline">
            <Activity className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Metrics Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayMetrics?.failed_login_attempts || 0}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rate Limit Hits</CardTitle>
              <TrendingUp className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayMetrics?.rate_limit_violations || 0}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayMetrics?.blocked_requests || 0}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Alerts</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {alerts.filter((a) => a.status === 'open').length}
              </div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Alerts */}
        {alerts.filter((a) => a.status === 'open').length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Active Security Alerts</AlertTitle>
            <AlertDescription>
              You have {alerts.filter((a) => a.status === 'open').length} open security alerts
              that require attention.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts">
              Security Alerts ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="events">
              Recent Events ({events.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
                <CardDescription>
                  Automated security alerts based on threat detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-success mb-4" />
                    <h3 className="text-lg font-semibold">No Active Alerts</h3>
                    <p className="text-muted-foreground">
                      All security metrics are within normal range
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Alert</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Events</TableHead>
                        <TableHead>First Seen</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{alert.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {alert.description}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(alert.status)}>
                              {alert.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{alert.event_count}</TableCell>
                          <TableCell>
                            {format(new Date(alert.first_seen_at), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {alert.status === 'open' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateAlert(alert.id, 'acknowledge')}
                                >
                                  Acknowledge
                                </Button>
                              )}
                              {(alert.status === 'open' || alert.status === 'acknowledged') && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => updateAlert(alert.id, 'resolve')}
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Security Events</CardTitle>
                <CardDescription>
                  Real-time log of security-related events
                </CardDescription>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Events Recorded</h3>
                    <p className="text-muted-foreground">
                      Security events will appear here as they occur
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Blocked</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">
                            {event.event_type.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getSeverityColor(event.severity)}>
                              {event.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {event.ip_address || 'N/A'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {event.endpoint || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {event.blocked ? (
                              <Badge variant="destructive">Yes</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(event.created_at), 'MMM dd, HH:mm:ss')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SecurityMonitoring;