import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { verifyTOTP } from "@/lib/security/totp";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TwoFactorVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  const userId = location.state?.userId;
  const returnTo = location.state?.returnTo || "/dashboard";

  useEffect(() => {
    // If no userId in state, redirect back to login
    if (!userId) {
      navigate("/auth/sign-in");
    }
  }, [userId, navigate]);

  const handleVerifyTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("กรุณากรอกรหัส 6 หลัก");
      return;
    }

    setIsVerifying(true);

    try {
      // Get user's TOTP secret
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("totp_secret")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      if (!profile?.totp_secret) {
        throw new Error("TOTP not configured");
      }

      // Verify TOTP code
      const isValid = await verifyTOTP(profile.totp_secret, code);

      if (isValid) {
        toast.success("ยืนยันตัวตนสำเร็จ!");
        // Refresh session to ensure proper authentication
        await supabase.auth.refreshSession();
        navigate(returnTo);
      } else {
        toast.error("รหัสไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
        setCode("");
      }
    } catch (error: any) {
      console.error("2FA verification error:", error);
      toast.error("เกิดข้อผิดพลาด", {
        description: error.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyBackupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupCode.trim()) {
      toast.error("กรุณากรอก Backup Code");
      return;
    }

    setIsVerifying(true);

    try {
      // Get user's backup codes
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("totp_backup_codes")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      if (!profile?.totp_backup_codes || profile.totp_backup_codes.length === 0) {
        throw new Error("No backup codes available");
      }

      // Check if backup code is valid
      const normalizedInput = backupCode.trim().toUpperCase().replace(/-/g, "");
      const isValid = profile.totp_backup_codes.some(
        (code: string) => code.replace(/-/g, "") === normalizedInput
      );

      if (isValid) {
        // Remove used backup code
        const updatedCodes = profile.totp_backup_codes.filter(
          (code: string) => code.replace(/-/g, "") !== normalizedInput
        );

        await supabase
          .from("profiles")
          .update({ totp_backup_codes: updatedCodes })
          .eq("id", userId);

        toast.success("ยืนยันด้วย Backup Code สำเร็จ!");
        toast.warning("Backup Code นี้ถูกใช้งานแล้วและจะไม่สามารถใช้ได้อีก", {
          description: "คุณมี Backup Code เหลืออยู่ " + updatedCodes.length + " รหัส",
        });

        // Refresh session
        await supabase.auth.refreshSession();
        navigate(returnTo);
      } else {
        toast.error("Backup Code ไม่ถูกต้อง");
        setBackupCode("");
      }
    } catch (error: any) {
      console.error("Backup code verification error:", error);
      toast.error("เกิดข้อผิดพลาด", {
        description: error.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            กรุณากรอกรหัส 6 หลักจาก Authenticator App ของคุณ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!useBackupCode ? (
            <form onSubmit={handleVerifyTOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">รหัสยืนยันตัวตน</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  เปิดแอป Authenticator ของคุณ (เช่น Google Authenticator, Authy) แล้วกรอกรหัส 6 หลักที่แสดง
                </AlertDescription>
              </Alert>

              <Button
                type="submit"
                className="w-full"
                disabled={isVerifying || code.length !== 6}
                variant="gradient"
              >
                {isVerifying ? "กำลังตรวจสอบ..." : "ยืนยันตัวตน"}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm"
                  onClick={() => setUseBackupCode(true)}
                >
                  ใช้ Backup Code แทน
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyBackupCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backupCode">Backup Code</Label>
                <Input
                  id="backupCode"
                  type="text"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="text-center tracking-wider"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Backup Code จะถูกใช้งานได้เพียงครั้งเดียวเท่านั้น
                </AlertDescription>
              </Alert>

              <Button
                type="submit"
                className="w-full"
                disabled={isVerifying || !backupCode.trim()}
                variant="gradient"
              >
                {isVerifying ? "กำลังตรวจสอบ..." : "ยืนยันด้วย Backup Code"}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm"
                  onClick={() => {
                    setUseBackupCode(false);
                    setBackupCode("");
                  }}
                >
                  กลับไปใช้ Authenticator App
                </Button>
              </div>
            </form>
          )}

          <div className="pt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                supabase.auth.signOut();
                navigate("/auth/sign-in");
              }}
            >
              ยกเลิกและกลับไปหน้า Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TwoFactorVerification;
