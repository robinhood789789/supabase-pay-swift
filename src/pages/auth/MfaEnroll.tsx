import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Download, Copy, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { getCSRFToken } from "@/lib/security/csrf";
import { generateTOTPSecret, getTOTPQRCodeUrl } from "@/lib/security/totp";

export default function MfaEnroll() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    checkAuthAndInitEnroll();
  }, []);

  const checkAuthAndInitEnroll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if already enrolled and has password change requirement
    const { data: profile } = await supabase
      .from("profiles")
      .select("totp_enabled, requires_password_change")
      .eq("id", user.id)
      .single();

    if (profile?.totp_enabled) {
      // MFA already enabled, check if password change is required
      if (profile?.requires_password_change) {
        navigate("/auth/password-change");
      } else {
        navigate(location.state?.returnTo || "/dashboard");
      }
      return;
    }

    // Start enrollment (MFA not enabled yet)
    await initEnrollment();
  };

  const initEnrollment = async () => {
    try {
      setUseFallback(false);
      
      // Get CSRF token and session for authentication
      const csrfToken = getCSRFToken();
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("mfa-enroll", {
        headers: {
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        }
      });

      if (error) throw error;

      // Generate QR code from otpauthUrl
      if (data.otpauthUrl) {
        const qrDataUrl = await QRCode.toDataURL(data.otpauthUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeUrl(qrDataUrl);
      }
      
      setSecret(data.secret);
      setRetryCount(0);
      setLoading(false);
    } catch (err: any) {
      console.error("Enrollment init error:", err);
      
      // Use client-side fallback
      await initFallbackEnrollment();
    }
  };

  const initFallbackEnrollment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("User email not found");

      toast.warning("ใช้โหมดสำรอง", {
        description: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กำลังสร้าง QR code ในเบราว์เซอร์"
      });

      // Generate secret client-side
      const clientSecret = generateTOTPSecret();
      const otpauthUrl = getTOTPQRCodeUrl(clientSecret, user.email, 'Payment Platform');
      
      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeUrl(qrDataUrl);
      setSecret(clientSecret);
      setUseFallback(true);
      setLoading(false);
      
      toast.info("โปรดทราบ", {
        description: "คุณกำลังใช้โหมดสำรอง กรุณายืนยัน MFA ให้เรียบร้อย"
      });
    } catch (err: any) {
      console.error("Fallback enrollment error:", err);
      setError("ไม่สามารถสร้าง QR code ได้ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setCode("");
    setError("");
    setQrCodeUrl("");
    setSecret("");
    setUseFallback(false);
    setLoading(true);
    
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    toast.info(`เริ่มต้นใหม่... (ครั้งที่ ${newRetryCount})`);
    await initEnrollment();
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("กรุณากรอกรหัส 6 หลัก");
      return;
    }

    setEnrolling(true);
    setError("");

    try {
      // Get CSRF token and session for authentication
      const csrfToken = getCSRFToken();
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!session || !user) throw new Error("Not authenticated");

      // If using fallback (client-generated secret), persist it before verify
      if (useFallback && secret) {
        const { error: setSecretError } = await supabase.rpc('update_totp_secret', {
          user_id: user.id,
          new_secret: secret,
        });
        if (setSecretError) throw setSecretError;
      }

      // Sanitize code to digits-only
      const cleaned = code.replace(/\D/g, '').slice(0, 6);

      const { data, error } = await supabase.functions.invoke("mfa-verify", {
        body: { code: cleaned },
        headers: {
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        }
      });

      if (error) throw error;

      if (data.success) {
        setBackupCodes(data.recovery_codes || []);
        setShowBackupCodes(true);
        toast.success("เปิดใช้งาน MFA สำเร็จ!");
      } else {
        setError(data.error || "รหัสไม่ถูกต้อง");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err?.message || "รหัสไม่ถูกต้อง กรุณาลองใหม่");
    } finally {
      setEnrolling(false);
    }
  };

  const handleCopyBackupCodes = () => {
    const codesText = backupCodes.join("\n");
    navigator.clipboard.writeText(codesText);
    setCopiedBackup(true);
    toast.success("คัดลอกรหัสกู้คืนแล้ว");
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    const codesText = backupCodes.join("\n");
    const blob = new Blob([`รหัสกู้คืน MFA\n\n${codesText}\n\nเก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย แต่ละรหัสใช้ได้เพียงครั้งเดียว`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mfa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ดาวน์โหลดรหัสกู้คืนแล้ว");
  };

  const handleContinue = async () => {
    // Check if password change is required
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("requires_password_change")
      .eq("id", user.id)
      .single();

    if (profile?.requires_password_change) {
      // After MFA setup, go to password change
      navigate("/auth/password-change");
    } else {
      // No password change required, go to dashboard
      navigate(location.state?.returnTo || "/dashboard");
    }
  };

  const handleCopyUrl = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      
      const otpauthUrl = getTOTPQRCodeUrl(secret, user.email, 'Payment Platform');
      await navigator.clipboard.writeText(otpauthUrl);
      setCopiedUrl(true);
      toast.success("คัดลอก URL แล้ว");
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      toast.error("ไม่สามารถคัดลอกได้");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center">กำลังโหลด...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showBackupCodes) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              เปิดใช้งาน MFA สำเร็จ
            </CardTitle>
            <CardDescription>
              รหัสกู้คืนของคุณ (แสดงครั้งเดียวเท่านั้น!)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย แต่ละรหัสใช้ได้เพียงครั้งเดียวเมื่อคุณไม่สามารถใช้แอปยืนยันตัวตนได้
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, idx) => (
                  <div key={idx} className="bg-background p-2 rounded text-center">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleCopyBackupCodes}
              >
                {copiedBackup ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedBackup ? "คัดลอกแล้ว" : "คัดลอก"}
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleDownloadBackupCodes}
              >
                <Download className="h-4 w-4 mr-2" />
                ดาวน์โหลด
              </Button>
            </div>

            <Button 
              className="w-full" 
              onClick={handleContinue}
            >
              ดำเนินการต่อ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ตั้งค่าการยืนยันตัวตนแบบ 2 ขั้นตอน (MFA)</CardTitle>
          <CardDescription>
            สแกน QR Code ด้วยแอป Google Authenticator หรือแอปยืนยันตัวตนอื่นๆ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {useFallback && (
            <Alert variant="default" className="border-orange-500">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription>
                <strong>โหมดสำรอง:</strong> กำลังใช้ QR code ที่สร้างในเบราว์เซอร์ หากต้องการใช้เซิร์ฟเวอร์ กรุณาคลิก "เริ่มต้นใหม่"
              </AlertDescription>
            </Alert>
          )}
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              จำเป็นต้องตั้งค่า MFA สำหรับบัญชีของคุณเพื่อความปลอดภัย
            </AlertDescription>
          </Alert>

          {qrCodeUrl && (
            <div className="flex flex-col items-center space-y-4">
              <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 border rounded-lg" />
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground mb-2">หรือกรอกรหัสด้วยตนเอง:</p>
                <code className="bg-muted px-3 py-1 rounded text-sm break-all">
                  {secret}
                </code>
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyUrl}
                  >
                    {copiedUrl ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copiedUrl ? "คัดลอก URL แล้ว" : "คัดลอก otpauth:// URL"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">กรอกรหัส 6 หลักจากแอป</label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setError("");
                }}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <p className="text-xs mt-2 opacity-80">
                  หากยืนยันไม่สำเร็จหลายครั้ง กรุณาเริ่มต้นใหม่ด้วยปุ่มด้านล่าง
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={enrolling || code.length !== 6}
            >
              {enrolling ? "กำลังยืนยัน..." : "ยืนยันและเปิดใช้งาน MFA"}
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleReset}
              disabled={enrolling}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              เริ่มต้นใหม่ (สร้าง QR Code ใหม่)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}