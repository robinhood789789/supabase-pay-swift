import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, DollarSign, Download, Upload, FileText, CheckCircle2, XCircle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ActivityLog } from "@/components/security/ActivityLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { PermissionGate } from "@/components/PermissionGate";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";

const Reports = () => {
  const { tenantId } = useAuth();
  const { activeTenantId } = useTenantSwitcher();
  const { toast } = useToast();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const [reconcileFile, setReconcileFile] = useState<File | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  
  const revenueData = [
    { month: "Jan", revenue: 4500, users: 120 },
    { month: "Feb", revenue: 5200, users: 145 },
    { month: "Mar", revenue: 4800, users: 132 },
    { month: "Apr", revenue: 6100, users: 178 },
    { month: "May", revenue: 7200, users: 203 },
    { month: "Jun", revenue: 8100, users: 234 },
  ];

  const userActivityData = [
    { day: "Mon", active: 245, new: 12 },
    { day: "Tue", active: 312, new: 18 },
    { day: "Wed", active: 289, new: 15 },
    { day: "Thu", active: 356, new: 22 },
    { day: "Fri", active: 401, new: 28 },
    { day: "Sat", active: 178, new: 8 },
    { day: "Sun", active: 156, new: 6 },
  ];

  const handleDownloadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', activeTenantId || tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const csv = [
        ['ID', 'Status', 'Amount', 'Currency', 'Method', 'Provider', 'Created', 'Paid At'].join(','),
        ...data.map(p => [
          p.id,
          p.status,
          (p.amount / 100).toFixed(2),
          p.currency,
          p.method || '',
          p.provider || '',
          p.created_at,
          p.paid_at || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: activeTenantId || tenantId,
        action: 'reports.export.transactions',
        target: 'payments',
        after: { count: data.length }
      });

      toast({
        title: "Success",
        description: "Transactions exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadSettlements = async () => {
    try {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('tenant_id', activeTenantId || tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const csv = [
        ['ID', 'Provider', 'Cycle', 'Paid Out', 'Fees', 'Net Amount', 'Created'].join(','),
        ...data.map(s => [
          s.id,
          s.provider,
          s.cycle,
          s.paid_out_at || '',
          (s.fees / 100).toFixed(2),
          (s.net_amount / 100).toFixed(2),
          s.created_at
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlements-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: activeTenantId || tenantId,
        action: 'reports.export.settlements',
        target: 'settlements',
        after: { count: data.length }
      });

      toast({
        title: "Success",
        description: "Settlements exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReconcileUpload = async () => {
    if (!reconcileFile) {
      toast({
        title: "Error",
        description: "Please select a file",
        variant: "destructive",
      });
      return;
    }

    setReconcileLoading(true);
    setReconcileResult(null);

    try {
      const formData = new FormData();
      formData.append('file', reconcileFile);
      formData.append('provider', 'stripe'); // Could be made dynamic
      formData.append('cycle', new Date().toISOString().split('T')[0]);
      formData.append('dateWindowDays', '3');

      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('reconcile-upload', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      setReconcileResult(data);
      toast({
        title: "Reconciliation Complete",
        description: `Matched: ${data.matched}, Unmatched: ${data.unmatched}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setReconcileLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <RequireTenant>
        <PermissionGate
          permissions={["reports.view"]}
          fallback={
            <div className="p-6">
              <div className="text-center p-8 border rounded-lg">
                <p className="text-muted-foreground">
                  คุณไม่มีสิทธิ์เข้าถึงหน้านี้
                </p>
              </div>
            </div>
          }
        >
        <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">Comprehensive insights into your business performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <DollarSign className="w-4 h-4 text-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$36,900</div>
                <p className="text-xs text-muted-foreground">
                  +18.2% from last period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Users
                </CardTitle>
                <Users className="w-4 h-4 text-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,012</div>
                <p className="text-xs text-muted-foreground">
                  +109 new this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Growth Rate
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+23.4%</div>
                <p className="text-xs text-muted-foreground">
                  Month over month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Conversion Rate
                </CardTitle>
                <BarChart3 className="w-4 h-4 text-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3.8%</div>
                <p className="text-xs text-muted-foreground">
                  +0.4% from last month
                </p>
              </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="users">User Activity</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="settlements">Settlements</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>
                  Monthly revenue and user growth over the last 6 months
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Revenue ($)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="users"
                      stroke="hsl(var(--secondary))"
                      strokeWidth={2}
                      name="Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Active Users</CardTitle>
                <CardDescription>
                  Active and new users by day of the week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={userActivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="active" fill="hsl(var(--primary))" name="Active Users" />
                    <Bar dataKey="new" fill="hsl(var(--success))" name="New Users" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>
                    Export all payment transactions as CSV
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => checkAndChallenge(handleDownloadTransactions)} 
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Click "Download CSV" to export transactions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settlements" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Settlement Reports</CardTitle>
                  <CardDescription>
                    View and export settlement data by cycle
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => checkAndChallenge(handleDownloadSettlements)} 
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  <div className="text-center">
                    <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Click "Download CSV" to export settlements</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Reconciliation</CardTitle>
                <CardDescription>
                  Upload settlement files (CSV/Excel) to match against recorded payments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="reconcile-file">Upload Settlement File</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="reconcile-file"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => setReconcileFile(e.target.files?.[0] || null)}
                        disabled={reconcileLoading}
                      />
                      <Button 
                        onClick={handleReconcileUpload} 
                        disabled={!reconcileFile || reconcileLoading}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {reconcileLoading ? 'Processing...' : 'Reconcile'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supported formats: CSV, Excel. File should contain columns for amount, reference/ID, and date.
                    </p>
                  </div>

                  {reconcileResult && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-muted border-border">
                          <CardContent className="pt-6">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-foreground" />
                              <div>
                                <p className="text-2xl font-bold">{reconcileResult.matched}</p>
                                <p className="text-sm text-muted-foreground">Matched</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-muted border-border">
                          <CardContent className="pt-6">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-5 h-5 text-foreground" />
                              <div>
                                <p className="text-2xl font-bold">{reconcileResult.unmatched}</p>
                                <p className="text-sm text-muted-foreground">Unmatched</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {reconcileResult.discrepancies && reconcileResult.discrepancies.length > 0 && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            <p className="font-semibold mb-2">Discrepancies Found:</p>
                            <ul className="space-y-1 text-sm">
                              {reconcileResult.discrepancies.slice(0, 5).map((disc: any, idx: number) => (
                                <li key={idx}>
                                  Row {disc.row}: ${disc.amount.toFixed(2)} - {disc.reason}
                                  {disc.reference && ` (Ref: ${disc.reference})`}
                                </li>
                              ))}
                              {reconcileResult.discrepancies.length > 5 && (
                                <li className="italic">... and {reconcileResult.discrepancies.length - 5} more</li>
                              )}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {!reconcileResult && (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground border rounded-lg border-dashed">
                      <div className="text-center">
                        <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Upload a settlement file to begin reconciliation</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            {tenantId && <ActivityLog tenantId={tenantId} />}
          </TabsContent>
        </Tabs>
        </div>
        </PermissionGate>
        <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
      </RequireTenant>
    </DashboardLayout>
  );
};

export default Reports;
