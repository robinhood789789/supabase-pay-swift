import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, CheckCircle2, XCircle, Lock } from "lucide-react";
import { toast } from "sonner";

export default function FirstLoginPasswordChange() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Password validation
  const hasMinLength = newPassword.length >= 10;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);
    setError("");

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Update profile: clear requires_password_change flag
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          requires_password_change: false,
          password_changed_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast.success("เปลี่ยนรหัสผ่านสำเร็จ", {
        description: "กำลังไปยังขั้นตอนการตั้งค่า 2FA",
      });

      // Redirect to MFA setup
      setTimeout(() => {
        navigate("/settings?tab=security&force_mfa=true");
      }, 1000);
    } catch (err: any) {
      console.error("Password change error:", err);
      setError(err.message || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">เปลี่ยนรหัสผ่าน</CardTitle>
          <CardDescription>
            กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งานระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="ระบุรหัสผ่านใหม่"
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="ระบุรหัสผ่านอีกครั้ง"
                disabled={isSubmitting}
              />
            </div>

            {/* Password requirements */}
            <div className="space-y-2 text-sm">
              <p className="font-medium">ข้อกำหนดรหัสผ่าน:</p>
              <div className="space-y-1">
                <RequirementItem met={hasMinLength} text="อย่างน้อย 10 ตัวอักษร" />
                <RequirementItem met={hasUpperCase} text="มีตัวพิมพ์ใหญ่ (A-Z)" />
                <RequirementItem met={hasLowerCase} text="มีตัวพิมพ์เล็ก (a-z)" />
                <RequirementItem met={hasNumber} text="มีตัวเลข (0-9)" />
                <RequirementItem met={passwordsMatch} text="รหัสผ่านตรงกัน" />
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                <strong>หลังจากเปลี่ยนรหัสผ่าน</strong> คุณจะต้องตั้งค่า Two-Factor Authentication
                (2FA) ด้วย Google Authenticator เพื่อความปลอดภัย
              </AlertDescription>
            </Alert>

            <Button
              type="submit"
              className="w-full"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่านและดำเนินการต่อ"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={met ? "text-green-700" : "text-muted-foreground"}>{text}</span>
    </div>
  );
}
