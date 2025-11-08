import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { RequireTenant } from '@/components/RequireTenant';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Rocket, 
  CheckCircle2, 
  AlertTriangle, 
  Shield,
  Globe,
  Webhook,
  Database,
  Lock,
  Activity,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  critical: boolean;
}

const checklistItems: ChecklistItem[] = [
  {
    id: 'domain_tls',
    label: 'Domain & TLS Certificate',
    description: 'Custom domain configured with valid HTTPS/TLS certificate',
    icon: Globe,
    critical: true,
  },
  {
    id: 'provider_credentials',
    label: 'Production Payment Provider',
    description: 'Live API credentials configured (not test/sandbox)',
    icon: CreditCard,
    critical: true,
  },
  {
    id: 'webhook_verified',
    label: 'Webhook Configuration',
    description: 'Webhook endpoints configured and verified working',
    icon: Webhook,
    critical: true,
  },
  {
    id: 'backup_schedule',
    label: 'Backup & Recovery',
    description: 'Regular backup schedule configured and tested',
    icon: Database,
    critical: true,
  },
  {
    id: 'admin_2fa',
    label: '2FA for All Admins',
    description: 'All admin users have 2FA enabled',
    icon: Shield,
    critical: true,
  },
  {
    id: 'logs_alerts',
    label: 'Monitoring & Alerts',
    description: 'Logging and alert systems configured',
    icon: Activity,
    critical: false,
  },
  {
    id: 'test_transactions',
    label: 'Test Transactions',
    description: 'End-to-end payment testing completed successfully',
    icon: CreditCard,
    critical: false,
  },
];

export default function GoLive() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: checklistData, isLoading } = useQuery({
    queryKey: ['go-live-checklist', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('go_live_checklist')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        const { data: newChecklist, error: insertError } = await supabase
          .from('go_live_checklist')
          .insert(
            checklistItems.map(item => ({
              tenant_id: tenantId,
              item: item.id,
              completed: false,
            }))
          )
          .select();

        if (insertError) throw insertError;
        return newChecklist;
      }

      return data;
    },
    enabled: !!tenantId,
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      const { error } = await supabase
        .from('go_live_checklist')
        .update({ 
          completed,
          completed_at: completed ? new Date().toISOString() : null 
        })
        .eq('item', itemId)
        .eq('tenant_id', tenantId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['go-live-checklist'] });
      toast.success('Checklist updated');
    },
    onError: () => {
      toast.error('Failed to update checklist');
    },
  });

  const completedCount = checklistData?.filter((item: any) => item.completed).length || 0;
  const totalCount = checklistData?.length || checklistItems.length;
  const progress = (completedCount / totalCount) * 100;
  const criticalItems = checklistItems.filter(item => item.critical);
  const criticalCompleted = checklistData?.filter((item: any) => 
    item.completed && criticalItems.some(ci => ci.id === item.item)
  ).length || 0;
  const allCriticalComplete = criticalCompleted === criticalItems.length;

  const handleToggle = (itemId: string, completed: boolean) => {
    updateChecklistMutation.mutate({ itemId, completed });
  };

  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Rocket className="h-8 w-8" />
                Go-Live Checklist
              </h1>
              <p className="text-muted-foreground">
                Complete all items before going live in production
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Readiness Status</CardTitle>
              <CardDescription>
                {completedCount} of {totalCount} items completed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="h-2" />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{completedCount}/{totalCount}</div>
                      <div className="text-sm text-muted-foreground">Total Items</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{criticalCompleted}/{criticalItems.length}</div>
                      <div className="text-sm text-muted-foreground">Critical Items</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Badge variant={allCriticalComplete ? "default" : "destructive"} className="text-lg py-1">
                        {allCriticalComplete ? "Ready" : "Not Ready"}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-2">Production Status</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {!allCriticalComplete && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    All critical items must be completed before going live
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {checklistItems.map((item, index) => {
                const checklistItem = checklistData?.find((d: any) => d.item === item.id);
                const completed = checklistItem?.completed || false;
                const Icon = item.icon;

                return (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id={item.id}
                        checked={completed}
                        onCheckedChange={(checked) => handleToggle(item.id, checked as boolean)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <Label
                              htmlFor={item.id}
                              className="text-base font-medium flex items-center gap-2 cursor-pointer"
                            >
                              <Icon className="h-4 w-4" />
                              {item.label}
                              {item.critical && (
                                <Badge variant="destructive" className="ml-2">Critical</Badge>
                              )}
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          </div>
                          {completed && (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {allCriticalComplete && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Ready for Production!</strong> All critical items are complete. You can now safely deploy to production.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
}
