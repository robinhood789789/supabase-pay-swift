import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Key, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function FirstLoginPasswordChange() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");

  const passwordChecks = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    match: newPassword === confirmPassword && newPassword.length > 0,
  };

  const allChecksPassed = Object.values(passwordChecks).every(Boolean);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth/sign-in');
        return;
      }

      // Check if user needs to change password
      const { data: profile } = await supabase
        .from('profiles')
        .select('requires_password_change, totp_enabled')
        .eq('id', session.user.id)
        .single();

      if (!profile?.requires_password_change) {
        navigate('/dashboard');
        return;
      }

      if (!profile?.totp_enabled) {
        navigate('/first-login/2fa-setup');
        return;
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allChecksPassed) {
      setError("กรุณาตรวจสอบเงื่อนไขรหัสผ่านให้ครบถ้วน");
      return;
    }

    if (!currentPassword) {
      setError("กรุณากรอกรหัสผ่านปัจจุบัน");
      return;
    }

    try {
      setChanging(true);
      setError("");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke('password-change', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Password change failed");

      toast({ 
        title: "เปลี่ยนรหัสผ่านสำเร็จ!", 
        description: "กำลังเข้าสู่ระบบ..." 
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error: any) {
      console.error('Password change error:', error);
      setError(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setChanging(false);
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
              <Key className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">เปลี่ยนรหัสผ่าน</CardTitle>
          <CardDescription>
            กรุณาเปลี่ยนรหัสผ่านชั่วคราวเป็นรหัสผ่านใหม่ของคุณ
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">รหัสผ่านชั่วคราว</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="รหัสผ่านที่ได้รับจาก Shareholder"
                disabled={changing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">รหัสผ่านใหม่</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านใหม่"
                disabled={changing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">ยืนยันรหัสผ่านใหม่</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                disabled={changing}
              />
            </div>

            {/* Password Requirements */}
            <Alert>
              <AlertDescription>
                <p className="text-sm font-semibold mb-2">เงื่อนไขรหัสผ่าน:</p>
                <div className="space-y-1 text-sm">
                  <PasswordCheck passed={passwordChecks.length}>
                    มีความยาวอย่างน้อย 8 ตัวอักษร
                  </PasswordCheck>
                  <PasswordCheck passed={passwordChecks.uppercase}>
                    มีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว
                  </PasswordCheck>
                  <PasswordCheck passed={passwordChecks.lowercase}>
                    มีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว
                  </PasswordCheck>
                  <PasswordCheck passed={passwordChecks.number}>
                    มีตัวเลขอย่างน้อย 1 ตัว
                  </PasswordCheck>
                  <PasswordCheck passed={passwordChecks.match}>
                    รหัสผ่านทั้งสองตรงกัน
                  </PasswordCheck>
                </div>
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit"
              disabled={changing || !allChecksPassed || !currentPassword}
              className="w-full"
            >
              {changing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังเปลี่ยนรหัสผ่าน...
                </>
              ) : (
                "เปลี่ยนรหัสผ่าน"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordCheck({ passed, children }: { passed: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={passed ? "text-green-600" : "text-muted-foreground"}>
        {children}
      </span>
    </div>
  );
}
