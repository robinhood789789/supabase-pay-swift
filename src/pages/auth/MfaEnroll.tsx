import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Download, Copy, CheckCircle, AlertCircle } from "lucide-react";
import QRCode from "qrcode";

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

  useEffect(() => {
    checkAuthAndInitEnroll();
  }, []);

  const checkAuthAndInitEnroll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if already enrolled
    const { data: profile } = await supabase
      .from("profiles")
      .select("totp_enabled")
      .eq("id", user.id)
      .single();

    if (profile?.totp_enabled) {
      // Already enrolled, check password change requirement
      const { data: profileData } = await supabase
        .from("profiles")
        .select("requires_password_change")
        .eq("id", user.id)
        .single();

      if (profileData?.requires_password_change) {
        navigate("/auth/password-change");
      } else {
        navigate(location.state?.returnTo || "/dashboard");
      }
      return;
    }

    // Start enrollment
    await initEnrollment();
  };

  const initEnrollment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("mfa-enroll");

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
      setLoading(false);
    } catch (err: any) {
      console.error("Enrollment init error:", err);
      setError("ไม่สามารถเริ่มการลงทะเบียน MFA ได้");
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setCode("");
    setError("");
    setQrCodeUrl("");
    setSecret("");
    setLoading(true);
    
    toast.info("เริ่มต้นใหม่...");
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
      const { data, error } = await supabase.functions.invoke("mfa-verify", {
        body: { code }
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
      setError("รหัสไม่ถูกต้อง กรุณาลองใหม่");
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
      navigate("/auth/password-change");
    } else {
      navigate(location.state?.returnTo || "/dashboard");
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
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              จำเป็นต้องตั้งค่า MFA สำหรับบัญชีของคุณเพื่อความปลอดภัย
            </AlertDescription>
          </Alert>

          {qrCodeUrl && (
            <div className="flex flex-col items-center space-y-4">
              <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 border rounded-lg" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">หรือกรอกรหัสด้วยตนเอง:</p>
                <code className="bg-muted px-3 py-1 rounded text-sm break-all">
                  {secret}
                </code>
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
              เริ่มต้นใหม่ (สร้าง QR Code ใหม่)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}