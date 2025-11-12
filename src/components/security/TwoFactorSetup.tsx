import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, Copy, CheckCircle2, AlertCircle, Download, Printer, RefreshCw, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateTOTPSecret, generateBackupCodes, getTOTPQRCodeUrl } from '@/lib/security/totp';
import QRCode from 'qrcode';

export function TwoFactorSetup() {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [setupStep, setSetupStep] = useState<'initial' | 'setup' | 'verify' | 'recovery-codes'>('initial');
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['profile-2fa', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('totp_enabled')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const enableMutation = useMutation({
    mutationFn: async ({ secret, codes }: { secret: string; codes: string[] }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          totp_secret: secret,
          totp_enabled: true,
          totp_backup_codes: codes,
        })
        .eq('id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-2fa'] });
      toast.success('2FA enabled successfully');
      setSetupStep('initial');
    },
  });

  const [disableCode, setDisableCode] = useState('');
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [useRecoveryForDisable, setUseRecoveryForDisable] = useState(false);

  const disableMutation = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.functions.invoke('mfa-disable', {
        body: { 
          code: code.toUpperCase(),
          type: useRecoveryForDisable ? 'recovery' : 'totp'
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-2fa'] });
      toast.success('2FA disabled successfully');
      setShowDisableDialog(false);
      setDisableCode('');
      setUseRecoveryForDisable(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to disable 2FA');
    },
  });

  const startSetup = async () => {
    try {
      // Call backend to enroll
      const { data, error } = await supabase.functions.invoke('mfa-enroll');
      
      if (error) throw error;
      
      setSecret(data.secret);
      const qr = await QRCode.toDataURL(data.otpauthUrl);
      setQrCodeUrl(qr);
      setSetupStep('setup');
      toast.success('Scan the QR code with your authenticator app');
    } catch (error: any) {
      toast.error(error.message || 'Failed to start enrollment');
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    try {
      // Call backend to verify and enable
      const { data, error } = await supabase.functions.invoke('mfa-verify', {
        body: { code: verificationCode }
      });
      
      if (error) throw error;
      
      // Store recovery codes
      setBackupCodes(data.recovery_codes);
      
      // Update local state
      queryClient.invalidateQueries({ queryKey: ['profile-2fa'] });
      toast.success('Two-factor authentication enabled successfully');
      
      // Move to recovery codes step
      setSetupStep('recovery-codes');
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadRecoveryCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([`Payment Platform - Recovery Codes\n\nGenerated: ${new Date().toLocaleString()}\n\n${content}\n\nKeep these codes safe. Each code can only be used once.`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-codes-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Recovery codes downloaded');
  };

  const printRecoveryCodes = () => {
    const printWindow = window.open('', '', 'width=600,height=400');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Recovery Codes</title>
            <style>
              body { font-family: monospace; padding: 20px; }
              h1 { font-size: 18px; }
              .code { padding: 5px; margin: 5px 0; }
            </style>
          </head>
          <body>
            <h1>Payment Platform - Recovery Codes</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Keep these codes safe. Each code can only be used once.</p>
            ${backupCodes.map(code => `<div class="code">${code}</div>`).join('')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('mfa-recovery-regen');
      if (error) throw error;
      return data.recovery_codes;
    },
    onSuccess: (newCodes) => {
      setBackupCodes(newCodes);
      setSetupStep('recovery-codes'); // Show codes modal
      queryClient.invalidateQueries({ queryKey: ['profile-2fa'] });
      toast.success('Recovery codes regenerated');
    },
  });

  // Recovery codes display after successful verification
  if (setupStep === 'recovery-codes') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Two-Factor Authentication Enabled
          </CardTitle>
          <CardDescription>
            Save these recovery codes - you'll only see them once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Save these recovery codes now. Each code can only be used once and you won't be able to see them again.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
              {backupCodes.map((code, i) => (
                <code key={i} className="text-sm font-mono">
                  {code}
                </code>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(backupCodes.join('\n'))}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadRecoveryCodes}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={printRecoveryCodes}
                className="flex-1"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>

          <Button onClick={() => {
            setSetupStep('initial');
            setBackupCodes([]);
            setVerificationCode('');
            setSecret('');
            setQrCodeUrl('');
          }} className="w-full">
            I've Saved My Recovery Codes
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (setupStep === 'setup') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Set Up Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrCodeUrl && (
            <div className="flex justify-center">
              <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Or enter this code manually:</Label>
            <div className="flex gap-2">
              <Input value={secret} readOnly className="font-mono" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(secret)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              After verification, you'll receive recovery codes. Save them in a secure location.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Enter verification code from your app</Label>
            <Input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-lg font-mono tracking-widest"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => {
              setSetupStep('initial');
              setVerificationCode('');
              setSecret('');
              setQrCodeUrl('');
            }} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={verifyAndEnable} className="flex-1" disabled={verificationCode.length !== 6}>
              Verify & Enable
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Disable dialog
  if (showDisableDialog) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Disable Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Enter your {useRecoveryForDisable ? 'recovery code' : 'authentication code'} to disable 2FA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Warning: Disabling 2FA will make your account less secure. You'll need to re-enroll if you want to enable it again.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="disable-code">
              {useRecoveryForDisable ? 'Recovery Code' : 'Authentication Code'}
            </Label>
            <Input
              id="disable-code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.toUpperCase())}
              placeholder={useRecoveryForDisable ? 'XXXX-XXXX' : '000000'}
              className="text-center text-lg font-mono tracking-widest"
              maxLength={useRecoveryForDisable ? 11 : 6}
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDisableDialog(false);
                setDisableCode('');
                setUseRecoveryForDisable(false);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setUseRecoveryForDisable(!useRecoveryForDisable);
                setDisableCode('');
              }}
              className="flex-1"
            >
              {useRecoveryForDisable ? 'Use authenticator' : 'Use recovery code'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => disableMutation.mutate(disableCode)}
              disabled={disableMutation.isPending || !disableCode.trim()}
              className="flex-1"
            >
              {disableMutation.isPending ? 'Disabling...' : 'Disable 2FA'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Two-Factor Authentication
          {profile?.totp_enabled && (
            <Badge variant="default" className="ml-auto">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Enabled
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Two-factor authentication adds an additional layer of security by requiring a verification code from your phone in addition to your password.
        </p>

        {profile?.totp_enabled ? (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Two-factor authentication is currently enabled on your account.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate Recovery Codes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableDialog(true)}
                >
                  Disable 2FA
                </Button>
              </div>
              <Link to="/settings/mfa-troubleshooting" className="w-full">
                <Button variant="outline" className="w-full">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  แก้ไขปัญหา 2FA
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={startSetup}>
              Enable Two-Factor Authentication
            </Button>
            <Link to="/settings/mfa-troubleshooting" className="block">
              <Button variant="ghost" size="sm" className="w-full">
                <HelpCircle className="w-4 h-4 mr-2" />
                มีปัญหาในการตั้งค่า 2FA?
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
