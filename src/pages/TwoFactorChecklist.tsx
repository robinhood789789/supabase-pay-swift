import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: 'enrollment' | 'login' | 'stepup' | 'recovery' | 'admin';
  status: 'pending' | 'pass' | 'fail';
}

const initialChecklist: ChecklistItem[] = [
  // Enrollment
  {
    id: 'enroll-1',
    title: 'Owner can enroll in 2FA',
    description: 'Navigate to /settings (Security tab), click "Enable Two-Factor Authentication", scan QR code, enter verification code',
    category: 'enrollment',
    status: 'pending'
  },
  {
    id: 'enroll-2',
    title: 'Recovery codes are generated',
    description: '10 recovery codes should be displayed once and can be copied/downloaded/printed',
    category: 'enrollment',
    status: 'pending'
  },
  {
    id: 'enroll-3',
    title: 'Invalid TOTP code is rejected',
    description: 'Try entering wrong 6-digit code during enrollment, should show error',
    category: 'enrollment',
    status: 'pending'
  },
  {
    id: 'enroll-4',
    title: 'Regenerate recovery codes works',
    description: 'Click "Regenerate Recovery Codes" button, old codes should be invalidated',
    category: 'enrollment',
    status: 'pending'
  },

  // Login
  {
    id: 'login-1',
    title: 'Owner login requires MFA challenge',
    description: 'Sign out and sign in as owner with 2FA enabled, should redirect to /auth/mfa-challenge',
    category: 'login',
    status: 'pending'
  },
  {
    id: 'login-2',
    title: 'Super admin login requires MFA',
    description: 'Super admin must pass MFA challenge even if tenant policy is disabled',
    category: 'login',
    status: 'pending'
  },
  {
    id: 'login-3',
    title: 'MFA challenge accepts valid TOTP',
    description: 'Enter valid 6-digit code from authenticator app, should proceed to dashboard',
    category: 'login',
    status: 'pending'
  },
  {
    id: 'login-4',
    title: 'MFA challenge accepts recovery code',
    description: 'Use recovery code instead of TOTP, should proceed and mark code as used',
    category: 'login',
    status: 'pending'
  },
  {
    id: 'login-5',
    title: 'Used recovery code cannot be reused',
    description: 'Try using the same recovery code again, should be rejected',
    category: 'login',
    status: 'pending'
  },

  // Step-up Authentication
  {
    id: 'stepup-1',
    title: 'Creating refund requires MFA step-up',
    description: 'Go to a payment detail, click Refund button, should prompt for MFA if window expired',
    category: 'stepup',
    status: 'pending'
  },
  {
    id: 'stepup-2',
    title: 'Creating payment link requires MFA',
    description: 'Navigate to /links, click Create Payment Link, should check MFA step-up',
    category: 'stepup',
    status: 'pending'
  },
  {
    id: 'stepup-3',
    title: 'Step-up window is respected',
    description: 'After successful MFA challenge, actions within 5 minutes should not require re-verification',
    category: 'stepup',
    status: 'pending'
  },
  {
    id: 'stepup-4',
    title: 'Expired step-up requires challenge',
    description: 'Wait 5+ minutes after MFA verification, should prompt for MFA again on sensitive action',
    category: 'stepup',
    status: 'pending'
  },

  // Recovery & Disable
  {
    id: 'recovery-1',
    title: 'Can disable 2FA when enrolled',
    description: 'In settings Security tab, click "Disable 2FA", should disable successfully',
    category: 'recovery',
    status: 'pending'
  },
  {
    id: 'recovery-2',
    title: 'Disabled 2FA removes requirement',
    description: 'After disabling 2FA, login and actions should not require MFA challenge',
    category: 'recovery',
    status: 'pending'
  },
  {
    id: 'recovery-3',
    title: 'Can re-enroll after disabling',
    description: 'After disabling, should be able to enroll again with new secret and recovery codes',
    category: 'recovery',
    status: 'pending'
  },

  // Admin & Policy
  {
    id: 'admin-1',
    title: 'Non-enrolled owner redirected to settings',
    description: 'If policy requires 2FA but owner not enrolled, login should redirect to /settings with message',
    category: 'admin',
    status: 'pending'
  },
  {
    id: 'admin-2',
    title: 'useMfaGuard blocks protected pages',
    description: 'Protected pages (e.g., /dashboard) should enforce MFA policy via useMfaGuard hook',
    category: 'admin',
    status: 'pending'
  },
  {
    id: 'admin-3',
    title: 'Audit logs record MFA events',
    description: 'Check /activity-history, should see mfa.enabled, mfa.challenge.success, mfa.disabled events',
    category: 'admin',
    status: 'pending'
  }
];

export default function TwoFactorChecklist() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist);

  const updateStatus = (id: string, status: 'pass' | 'fail') => {
    setChecklist(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status } : item
      )
    );
  };

  const categories = [
    { id: 'enrollment', label: 'Enrollment', icon: Shield },
    { id: 'login', label: 'Login Flow', icon: CheckCircle2 },
    { id: 'stepup', label: 'Step-Up Authentication', icon: AlertCircle },
    { id: 'recovery', label: 'Recovery & Disable', icon: Info },
    { id: 'admin', label: 'Admin & Policy', icon: Shield }
  ];

  const getStats = () => {
    const total = checklist.length;
    const passed = checklist.filter(item => item.status === 'pass').length;
    const failed = checklist.filter(item => item.status === 'fail').length;
    const pending = total - passed - failed;
    return { total, passed, failed, pending };
  };

  const stats = getStats();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8" />
            2FA Testing Checklist
          </h1>
          <p className="text-muted-foreground">
            Complete testing checklist for Two-Factor Authentication system
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 dark:bg-emerald-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Passed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.passed}</div>
            </CardContent>
          </Card>
          <Card className="bg-rose-50 dark:bg-rose-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-300">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{stats.failed}</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.pending}</div>
            </CardContent>
          </Card>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This checklist covers the complete 2FA implementation. Test each scenario and mark as pass/fail.
            All tests should pass before deploying to production.
          </AlertDescription>
        </Alert>

        {categories.map(category => {
          const items = checklist.filter(item => item.category === category.id);
          const Icon = category.icon;
          
          return (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  {category.label}
                </CardTitle>
                <CardDescription>
                  {items.filter(i => i.status === 'pass').length} / {items.length} tests passed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map(item => (
                  <div key={item.id} className="flex items-start gap-4 p-4 rounded-lg border">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{item.title}</h4>
                        {item.status === 'pass' && (
                          <Badge variant="default" className="bg-emerald-500">Passed</Badge>
                        )}
                        {item.status === 'fail' && (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                        {item.status === 'pending' && (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(item.id, 'pass')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          item.status === 'pass'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, 'fail')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          item.status === 'fail'
                            ? 'bg-rose-500 text-white'
                            : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        }`}
                      >
                        Fail
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
