import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { verifyTOTP } from '@/lib/security/totp';
import { toast } from 'sonner';

interface TwoFactorChallengeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  context?: string;
}

export function TwoFactorChallenge({ 
  open, 
  onOpenChange, 
  onSuccess,
  title = "ยืนยันตัวตนของคุณ",
  description = "กรุณากรอกรหัสยืนยันตัวตน จากแอป Authenticator ของคุณเอง",
  context
}: TwoFactorChallengeProps) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('Please enter a code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('totp_secret, totp_backup_codes')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error('Profile not found');

      // Check if it's a 6-digit TOTP code
      if (code.length === 6 && /^\d+$/.test(code)) {
        const isValid = await verifyTOTP(profile.totp_secret || '', code);
        if (isValid) {
          // Update last verified timestamp (and ensure error is handled)
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ mfa_last_verified_at: new Date().toISOString() })
            .eq('id', user.id);
          if (updateErr) throw updateErr;
          
          toast.success('Verification successful');
          onSuccess();
          onOpenChange(false);
          setCode('');
          return;
        }
      }

      // Check if it's a recovery code
      const backupCodes = profile.totp_backup_codes || [];
      const codeIndex = backupCodes.indexOf(code.toUpperCase().replace(/-/g, ''));
      
      if (codeIndex !== -1) {
        // Remove used backup code
        const newBackupCodes = backupCodes.filter((_: string, i: number) => i !== codeIndex);
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ 
            totp_backup_codes: newBackupCodes,
            mfa_last_verified_at: new Date().toISOString()
          })
          .eq('id', user.id);
        if (updateErr) throw updateErr;
        
        toast.success('Recovery code accepted');
        onSuccess();
        onOpenChange(false);
        setCode('');
        return;
      }

      setError('Invalid code. Please try again.');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {context && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{context}</AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="mfa-code">Authentication Code</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="000000 or XXXX-XXXX"
              className="text-center text-lg font-mono tracking-widest"
              maxLength={11}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerify();
              }}
            />
            <p className="text-xs text-muted-foreground">
              Enter a 6-digit code from your authenticator app or a recovery code
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setCode('');
                setError('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isVerifying || !code.trim()}
              className="flex-1"
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
