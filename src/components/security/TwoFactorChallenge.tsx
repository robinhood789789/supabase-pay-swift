import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { verifyTOTP } from '@/lib/security/totp';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

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
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [isCodeExpired, setIsCodeExpired] = useState(false);

  // TOTP countdown timer (30-second window)
  useEffect(() => {
    if (!open) return;

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 30 - (now % 30);
      setCountdown(remaining);
      setIsCodeExpired(remaining <= 5); // Warn when less than 5 seconds
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCode('');
      setError('');
      setRemainingAttempts(null);
      setIsCodeExpired(false);
    }
  }, [open]);

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('Please enter a code');
      return;
    }

    setIsVerifying(true);
    setError('');

    let data: any = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Prepare code and type
      const isRecovery = code.includes('-');
      const type = isRecovery ? 'recovery' : 'totp';
      const payloadCode = isRecovery 
        ? code.toUpperCase().replace(/[^A-Z0-9-]/g, '') // keep A-Z,0-9 and dashes
        : code.replace(/\D/g, '').slice(0, 6); // digits only, max 6

      if (!payloadCode) throw new Error('Missing verification code');
      if (type === 'totp' && payloadCode.length !== 6) {
        throw new Error('Please enter a 6-digit code');
      }

      // Include auth header explicitly for reliability
      const { data: { session } } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke('mfa-challenge', {
        body: { code: payloadCode, type },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      
      data = response.data;
      const error = response.error;
      
      if (error) throw new Error(error.message || 'Verification failed');
      if (data?.error) throw new Error(data.error);
      if (!data?.ok) throw new Error('Verification failed');

      // Update remaining attempts from server
      if (data?.remaining_attempts !== undefined) {
        setRemainingAttempts(data.remaining_attempts);
      }

      toast.success('Verification successful');
      onSuccess();
      onOpenChange(false);
      setCode('');
      return;
    } catch (err: any) {
      const msg = err?.message || 'Verification failed';
      setError(msg);
      
      // Extract remaining attempts from error response
      if (err?.context?.body?.remaining_attempts !== undefined) {
        setRemainingAttempts(err.context.body.remaining_attempts);
      } else if (data?.remaining_attempts !== undefined) {
        setRemainingAttempts(data.remaining_attempts);
      }
      
      toast.error(msg);
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

          {/* TOTP Countdown Timer */}
          <Alert className="border-primary/20 bg-primary/5">
            <Clock className="h-4 w-4 text-primary" />
            <AlertTitle className="text-sm font-medium mb-2">รหัสจะหมดอายุใน {countdown} วินาที</AlertTitle>
            <Progress 
              value={(countdown / 30) * 100} 
              className={`h-2 ${isCodeExpired ? 'bg-red-100' : ''}`}
            />
            {isCodeExpired && (
              <AlertDescription className="text-xs text-orange-600 mt-2">
                รหัสกำลังจะหมดอายุ! กรุณารอรหัสใหม่จากแอป Authenticator
              </AlertDescription>
            )}
          </Alert>

          {/* Time Sync Hint */}
          <Alert>
            <RefreshCw className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>เคล็ดลับ:</strong> หากรหัสไม่ถูกต้อง ตรวจสอบว่าเวลาบนอุปกรณ์ของคุณ{' '}
              <strong>ซิงค์อัตโนมัติ</strong> กับเซิร์ฟเวอร์ (Settings → Date & Time → Automatic)
            </AlertDescription>
          </Alert>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {remainingAttempts !== null && (
                  <div className="mt-1 font-semibold">
                    ❗ เหลือความพยายาม: {remainingAttempts} ครั้ง
                  </div>
                )}
              </AlertDescription>
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
