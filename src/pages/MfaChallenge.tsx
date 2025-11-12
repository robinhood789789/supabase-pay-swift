import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function MfaChallenge() {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as any)?.returnTo || '/dashboard';

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth/sign-in');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('Please enter a code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('mfa-verify', {
        body: { 
          code: code.toUpperCase(), 
          type: useRecovery ? 'recovery' : 'totp'
        }
      });

      if (error) throw error;

      if (data.ok) {
        toast.success('Verification successful');
        navigate(returnTo);
      } else {
        setError('Invalid code. Please try again.');
      }
    } catch (err: any) {
      const message = err.message || 'Verification failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Shield className="w-6 h-6" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Enter your authentication code to continue
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="mfa-code">
              {useRecovery ? 'Recovery Code' : 'Authentication Code'}
            </Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={useRecovery ? 'XXXX-XXXX' : '000000'}
              className="text-center text-lg font-mono tracking-widest"
              maxLength={useRecovery ? 11 : 6}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerify();
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {useRecovery 
                ? 'Enter one of your recovery codes' 
                : 'Enter the 6-digit code from your authenticator app'
              }
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setUseRecovery(!useRecovery);
                setCode('');
                setError('');
              }}
              className="flex-1"
            >
              {useRecovery ? 'Use authenticator' : 'Use recovery code'}
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isVerifying || !code.trim()}
              className="flex-1"
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="link"
              onClick={() => navigate('/auth/sign-in')}
              className="text-sm"
            >
              Back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
