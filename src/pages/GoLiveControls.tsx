import { useState } from 'react';
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
  Shield, 
  CheckCircle2, 
  AlertTriangle,
  Users,
  Link2,
  DollarSign,
  Download,
  Bell,
  UserCog,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ControlStep {
  id: string;
  label: string;
  description: string;
  icon: any;
  testInstructions: string;
  critical: boolean;
}

interface ControlsChecklist {
  id?: string;
  tenant_id: string;
  step1_invite_admins: boolean;
  step2_admin_create_links: boolean;
  step3_approval_flow: boolean;
  step4_large_export: boolean;
  step5_alert_trigger: boolean;
  step6_role_change: boolean;
  step7_secret_rotation: boolean;
  notes: any;
}

const controlSteps: ControlStep[] = [
  {
    id: 'step1_invite_admins',
    label: 'Step 1: Invite & Force 2FA',
    description: 'Owner invites Admin A (Support) & Admin B (Finance). Force 2FA for both.',
    testInstructions: 'Go to Members, invite 2 users with admin/finance roles, enable "Force 2FA", verify they complete setup',
    icon: Users,
    critical: true,
  },
  {
    id: 'step2_admin_create_links',
    label: 'Step 2: Admin Activity Timeline',
    description: 'Admin A creates 3 payment links; Owner can see A\'s activity timeline with IP/device/request ID.',
    testInstructions: 'Admin A creates 3 payment links. Owner views Activity History, filters by Admin A, verifies IP/device/timestamps',
    icon: Link2,
    critical: true,
  },
  {
    id: 'step3_approval_flow',
    label: 'Step 3: Approval & Dual Control',
    description: 'Admin B tries refund above threshold → "Requires approval"; Owner approves with 2FA → refund executes.',
    testInstructions: 'Set refund guardrail (amount > X). Admin B attempts refund. Owner gets approval request, uses 2FA, approves. Verify audit log.',
    icon: DollarSign,
    critical: true,
  },
  {
    id: 'step4_large_export',
    label: 'Step 4: Large Export with MFA',
    description: 'Admin A exports 50k rows → 2FA challenge; export has checksum + audit record.',
    testInstructions: 'Admin A exports large dataset (>5000 rows). Verify MFA challenge appears, export downloads with SHA-256 checksum.',
    icon: Download,
    critical: true,
  },
  {
    id: 'step5_alert_trigger',
    label: 'Step 5: Alert Rules & Notifications',
    description: 'Alert rule "Exports outside hours" triggers → alert_event + notification → Owner ack & close.',
    testInstructions: 'Create alert rule for exports outside business hours. Trigger condition. Verify alert fires, notification sent, Owner acknowledges.',
    icon: Bell,
    critical: false,
  },
  {
    id: 'step6_role_change',
    label: 'Step 6: Role Change Audit',
    description: 'Owner changes Admin B role template → role_assignments_log + audit (before/after).',
    testInstructions: 'Owner changes Admin B from Finance to Developer role. Verify role_assignments_log entry and audit_logs with before/after states.',
    icon: UserCog,
    critical: true,
  },
  {
    id: 'step7_secret_rotation',
    label: 'Step 7: Super Admin Secret Rotation',
    description: 'Super Admin rotates a platform secret → step-up MFA enforced; global audit shows event.',
    testInstructions: '(Super Admin only) Rotate API key or webhook secret. Verify MFA challenge, global audit log records action.',
    icon: Key,
    critical: false,
  },
];

const GoLiveControls = () => {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: checklist, isLoading } = useQuery<ControlsChecklist>({
    queryKey: ['go-live-controls', tenantId],
    queryFn: async () => {
      // Use tenant_security_policy or create a new table for this
      // For now, store in notes field of go_live_checklist
      const { data, error } = await supabase
        .from('go_live_checklist')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        const { data: newChecklist, error: insertError } = await supabase
          .from('go_live_checklist')
          .insert({
            tenant_id: tenantId,
            notes: {
              controls: {
                step1_invite_admins: false,
                step2_admin_create_links: false,
                step3_approval_flow: false,
                step4_large_export: false,
                step5_alert_trigger: false,
                step6_role_change: false,
                step7_secret_rotation: false,
              }
            },
          })
          .select()
          .single();

        if (insertError) throw insertError;
        const newChecklistNotes = newChecklist?.notes as any;
        return {
          tenant_id: tenantId,
          ...(newChecklistNotes?.controls || {}),
          notes: newChecklist?.notes || {},
        } as ControlsChecklist;
      }

      const notesData = data.notes as any;
      const controls = notesData?.controls || {};
      setNotes(notesData?.controlNotes || {});
      return {
        tenant_id: tenantId,
        ...controls,
        notes: data.notes || {},
      } as ControlsChecklist;
    },
    enabled: !!tenantId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { stepId: string, value: boolean }) => {
      const currentNotes = checklist?.notes as any || {};
      const currentControls = currentNotes.controls || {};
      
      const updatedNotes = {
        ...currentNotes,
        controls: {
          ...currentControls,
          [updates.stepId]: updates.value,
        },
        controlNotes: notes,
      };

      const { error } = await supabase
        .from('go_live_checklist')
        .update({ notes: updatedNotes })
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['go-live-controls'] });
      toast.success('Progress saved');
    },
    onError: (error) => {
      toast.error('Failed to update', {
        description: error.message,
      });
    },
  });

  const handleCheckboxChange = (stepId: string, checked: boolean) => {
    updateMutation.mutate({ stepId, value: checked });
  };

  const handleNotesUpdate = (stepId: string, value: string) => {
    const updatedNotes = { ...notes, [stepId]: value };
    setNotes(updatedNotes);
    updateMutation.mutate({ stepId: 'notes', value: true }); // Trigger save
  };

  const calculateProgress = () => {
    if (!checklist) return 0;
    const completed = controlSteps.filter(step => checklist[step.id as keyof ControlsChecklist]).length;
    return Math.round((completed / controlSteps.length) * 100);
  };

  const criticalStepsComplete = () => {
    if (!checklist) return false;
    return controlSteps
      .filter(step => step.critical)
      .every(step => checklist[step.id as keyof ControlsChecklist]);
  };

  const allStepsComplete = () => {
    if (!checklist) return false;
    return controlSteps.every(step => checklist[step.id as keyof ControlsChecklist]);
  };

  const progress = calculateProgress();
  const controlsReady = criticalStepsComplete();

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
              <Shield className="w-8 h-8" />
              Go-Live Admin Controls Test
            </h1>
            <p className="text-muted-foreground mt-1">
              Verify 2FA, approvals, guardrails, and audit trails before production
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Control Testing Progress: {progress}%</CardTitle>
                {allStepsComplete() ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    All Tests Passed
                  </Badge>
                ) : controlsReady ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Critical Tests Done
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Tests Incomplete
                  </Badge>
                )}
              </div>
              <Progress value={progress} className="mt-2" />
            </CardHeader>
            <CardContent>
              {controlsReady ? (
                <Alert className="border-success">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription>
                    All critical controls have been tested! Your system is ready for production compliance.
                    {!allStepsComplete() && ' Consider completing optional tests for full coverage.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Critical control tests must be completed before production launch.
                    Review the test steps below.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Controls & 2FA Test Checklist</CardTitle>
              <CardDescription>
                Follow each step to verify security controls. Items marked{' '}
                <Badge variant="destructive" className="text-xs">Critical</Badge> are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {controlSteps.map((step, index) => {
                const Icon = step.icon;
                const isChecked = checklist?.[step.id as keyof ControlsChecklist] || false;

                return (
                  <div key={step.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={step.id}
                          checked={isChecked}
                          onCheckedChange={(checked) => 
                            handleCheckboxChange(step.id, checked as boolean)
                          }
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <Label
                              htmlFor={step.id}
                              className="text-base font-medium cursor-pointer"
                            >
                              {step.label}
                            </Label>
                            {step.critical && (
                              <Badge variant="destructive" className="text-xs">
                                Critical
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {step.description}
                          </p>
                          <div className="mt-2 p-3 bg-muted/50 rounded-md">
                            <Label className="text-xs font-semibold">Test Instructions:</Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {step.testInstructions}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="ml-9 space-y-2">
                        <Label htmlFor={`notes-${step.id}`} className="text-xs text-muted-foreground">
                          Test Results / Notes
                        </Label>
                        <Textarea
                          id={`notes-${step.id}`}
                          placeholder="Record test results, timestamps, evidence links..."
                          value={notes[step.id] || ''}
                          onChange={(e) => handleNotesUpdate(step.id, e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Evidence</CardTitle>
              <CardDescription>
                Store test results for audit and compliance requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                All test results are automatically saved and can be exported for:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>SOC 2 compliance audits</li>
                <li>Internal security reviews</li>
                <li>Penetration test evidence</li>
                <li>Regulatory compliance (PCI DSS, etc.)</li>
              </ul>
              <Button variant="outline" className="w-full" onClick={() => toast.info('Export feature coming soon')}>
                <Download className="w-4 h-4 mr-2" />
                Export Test Results
              </Button>
            </CardContent>
          </Card>

          {controlsReady && (
            <Alert className="border-success">
              <Shield className="h-4 w-4 text-success" />
              <AlertDescription>
                Your admin controls are production-ready! All critical security tests have passed.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default GoLiveControls;
