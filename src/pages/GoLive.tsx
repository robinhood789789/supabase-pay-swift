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

interface Checklist {
  id?: string;
  tenant_id: string;
  domain_tls: boolean;
  provider_credentials: boolean;
  webhook_verified: boolean;
  backup_schedule: boolean;
  admin_2fa: boolean;
  logs_alerts: boolean;
  test_transactions: boolean;
  notes: any; // Allow any type since it comes from database as Json
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
    label: 'Webhook Endpoints Verified',
    description: 'All webhook endpoints tested and receiving events',
    icon: Webhook,
    critical: true,
  },
  {
    id: 'backup_schedule',
    label: 'Backup Schedule Configured',
    description: 'Database backups enabled and scheduled',
    icon: Database,
    critical: true,
  },
  {
    id: 'admin_2fa',
    label: 'Admin 2FA Enabled',
    description: 'Two-factor authentication active for all owner accounts',
    icon: Shield,
    critical: true,
  },
  {
    id: 'logs_alerts',
    label: 'Logging & Alerts Configured',
    description: 'Error monitoring and alerting system in place',
    icon: Activity,
    critical: false,
  },
  {
    id: 'test_transactions',
    label: 'Test Transactions Passed',
    description: 'End-to-end payment flow tested successfully',
    icon: CheckCircle2,
    critical: true,
  },
];

const GoLive = () => {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: checklist, isLoading } = useQuery<Checklist>({
    queryKey: ['go-live-checklist', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('go_live_checklist')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        // Create initial checklist
        const { data: newChecklist, error: insertError } = await supabase
          .from('go_live_checklist')
          .insert({
            tenant_id: tenantId,
            domain_tls: false,
            provider_credentials: false,
            webhook_verified: false,
            backup_schedule: false,
            admin_2fa: false,
            logs_alerts: false,
            test_transactions: false,
            notes: {},
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newChecklist as Checklist;
      }

      setNotes((data.notes as Record<string, string>) || {});
      return data as Checklist;
    },
    enabled: !!tenantId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Checklist>) => {
      const { error } = await supabase
        .from('go_live_checklist')
        .update(updates)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['go-live-checklist'] });
    },
    onError: (error) => {
      toast.error('Failed to update checklist', {
        description: error.message,
      });
    },
  });

  const handleCheckboxChange = (itemId: string, checked: boolean) => {
    updateMutation.mutate({ [itemId]: checked });
  };

  const handleNotesUpdate = (itemId: string, value: string) => {
    const updatedNotes = { ...notes, [itemId]: value };
    setNotes(updatedNotes);
    updateMutation.mutate({ notes: updatedNotes });
  };

  const calculateProgress = () => {
    if (!checklist) return 0;
    const completed = checklistItems.filter(item => checklist[item.id as keyof Checklist]).length;
    return Math.round((completed / checklistItems.length) * 100);
  };

  const criticalItemsComplete = () => {
    if (!checklist) return false;
    return checklistItems
      .filter(item => item.critical)
      .every(item => checklist[item.id as keyof Checklist]);
  };

  const allItemsComplete = () => {
    if (!checklist) return false;
    return checklistItems.every(item => checklist[item.id as keyof Checklist]);
  };

  const progress = calculateProgress();
  const readyToLaunch = criticalItemsComplete();

  if (isLoading) {
    return (
      <DashboardLayout>
        <RequireTenant>
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/4"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </RequireTenant>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Rocket className="w-8 h-8" />
              Go-Live Readiness
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete this checklist before launching to production
            </p>
          </div>

          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Launch Readiness: {progress}%</CardTitle>
                {allItemsComplete() ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    All Complete
                  </Badge>
                ) : readyToLaunch ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Ready to Launch
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Not Ready
                  </Badge>
                )}
              </div>
              <Progress value={progress} className="mt-2" />
            </CardHeader>
            <CardContent>
              {readyToLaunch ? (
                <Alert className="border-success">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription>
                    All critical items are complete! You're ready to launch to production.
                    {!allItemsComplete() && ' Consider completing optional items for best practices.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Critical items must be completed before launching to production.
                    Review the checklist below.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Checklist Items */}
          <Card>
            <CardHeader>
              <CardTitle>Pre-Launch Checklist</CardTitle>
              <CardDescription>
                Items marked with <Badge variant="destructive" className="text-xs">Critical</Badge> are required
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {checklistItems.map((item, index) => {
                const Icon = item.icon;
                const isChecked = checklist?.[item.id as keyof Checklist] || false;

                return (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={item.id}
                          checked={isChecked}
                          onCheckedChange={(checked) => 
                            handleCheckboxChange(item.id, checked as boolean)
                          }
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <Label
                              htmlFor={item.id}
                              className="text-base font-medium cursor-pointer"
                            >
                              {item.label}
                            </Label>
                            {item.critical && (
                              <Badge variant="destructive" className="text-xs">
                                Critical
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {/* Notes section */}
                      <div className="ml-9 space-y-2">
                        <Label htmlFor={`notes-${item.id}`} className="text-xs text-muted-foreground">
                          Notes (optional)
                        </Label>
                        <Textarea
                          id={`notes-${item.id}`}
                          placeholder="Add notes, links, or verification details..."
                          value={notes[item.id] || ''}
                          onChange={(e) => handleNotesUpdate(item.id, e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Deployment Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Deployment Resources
              </CardTitle>
              <CardDescription>
                Additional resources to help with your launch
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/docs" target="_blank" rel="noopener noreferrer">
                  <Activity className="w-4 h-4 mr-2" />
                  API Documentation
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="https://docs.lovable.dev" target="_blank" rel="noopener noreferrer">
                  <Globe className="w-4 h-4 mr-2" />
                  Lovable Documentation
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/settings" target="_blank" rel="noopener noreferrer">
                  <Shield className="w-4 h-4 mr-2" />
                  Security Settings
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Launch Button */}
          {readyToLaunch && (
            <Alert className="border-success">
              <Rocket className="h-4 w-4 text-success" />
              <AlertDescription className="flex items-center justify-between">
                <span>You're ready to launch! Review DEPLOY.md for final steps.</span>
                <Button size="sm" className="gap-2">
                  <Rocket className="w-4 h-4" />
                  View Deployment Guide
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default GoLive;
