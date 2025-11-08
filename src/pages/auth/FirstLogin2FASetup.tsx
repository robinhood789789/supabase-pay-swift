import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeCanvas } from "qrcode.react";

export default function FirstLogin2FASetup() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    initEnrollment();
  }, []);

  const initEnrollment = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth/sign-in');
        return;
      }

      // Check if user needs to setup 2FA
      const { data: profile } = await supabase
        .from('profiles')
        .select('totp_enabled')
        .eq('id', session.user.id)
        .single();

      if (profile?.totp_enabled) {
        navigate('/first-login/change-password');
        return;
      }

      // Generate TOTP secret
      const { data, error } = await supabase.functions.invoke('mfa-enroll', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setSecret(data.secret);
      setQrCodeUrl(data.qr_code_url);
    } catch (error: any) {
      console.error('Error initializing enrollment:', error);
      toast({ 
        title: "เกิดข้อผิดพลาด", 
        description: error.message || "ไม่สามารถเริ่มต้นการตั้งค่า 2FA ได้",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (token.length !== 6) {
      setError("กรุณากรอกรหัส 6 หลัก");
      return;
    }

    try {
      setVerifying(true);
      setError("");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke('mfa-verify', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { token },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Verification failed");

      toast({ 
        title: "ตั้งค่า 2FA สำเร็จ!", 
        description: "กำลังไปยังหน้าเปลี่ยนรหัสผ่าน..." 
      });

      setTimeout(() => {
        navigate('/first-login/change-password');
      }, 1000);
    } catch (error: any) {
      console.error('Verification error:', error);
      setError(error.message || "รหัสไม่ถูกต้อง กรุณาลองใหม่");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">ตั้งค่า Two-Factor Authentication</CardTitle>
          <CardDescription>
            สแกน QR Code ด้วย Google Authenticator เพื่อความปลอดภัย
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <ol className="list-decimal list-inside space-y-1 mt-2">
                <li>ติดตั้งแอป Google Authenticator</li>
                <li>เปิดแอปและสแกน QR Code ด้านล่าง</li>
                <li>กรอกรหัส 6 หลักที่แสดงในแอป</li>
              </ol>
            </AlertDescription>
          </Alert>

          {qrCodeUrl && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeCanvas value={qrCodeUrl} size={200} />
              </div>

              <div className="w-full space-y-2">
                <Label className="text-sm text-muted-foreground">
                  หรือกรอกรหัสด้วยตนเอง:
                </Label>
                <Input 
                  value={secret}
                  readOnly
                  className="font-mono text-center"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="token">กรอกรหัส 6 หลักจาก Authenticator</Label>
            <Input
              id="token"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl font-mono tracking-widest"
              disabled={verifying}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <Button 
            onClick={handleVerify}
            disabled={verifying || token.length !== 6}
            className="w-full"
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังตรวจสอบ...
              </>
            ) : (
              "ยืนยันและดำเนินการต่อ"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            การตั้งค่า 2FA เป็นขั้นตอนบังคับสำหรับความปลอดภัยของบัญชี
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
