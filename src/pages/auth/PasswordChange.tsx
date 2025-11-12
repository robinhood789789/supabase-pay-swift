import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Eye, EyeOff, AlertCircle, Lock } from "lucide-react";
import { getCSRFToken } from "@/lib/security/csrf";
import { usePasswordStrength } from "@/hooks/usePasswordStrength";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { PasswordBreachAlert, isPasswordBreachError } from "@/components/security/PasswordBreachAlert";
import { logPasswordBreachEvent, logPasswordBreachResolution } from "@/lib/security/passwordBreachLogger";

export default function PasswordChange() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [showBreachAlert, setShowBreachAlert] = useState(false);
  
  const passwordStrength = usePasswordStrength(newPassword, confirmPassword);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if password change is required and MFA is enabled
    const { data: profile } = await supabase
      .from("profiles")
      .select("requires_password_change, totp_enabled")
      .eq("id", user.id)
      .single();

    // MFA must be enabled before password change
    if (!profile?.totp_enabled) {
      console.log('[Password Change] MFA not enabled, redirecting to enrollment');
      navigate("/auth/mfa-enroll");
      return;
    }

    if (!profile?.requires_password_change) {
      // Not required, redirect
      navigate(location.state?.returnTo || "/dashboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    if (!Object.values(passwordStrength.checks).every(v => v)) {
      setError("รหัสผ่านไม่ตรงตามเงื่อนไข");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get CSRF token and session for authentication
      const csrfToken = getCSRFToken();
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("password-change", {
        body: { currentPassword, newPassword },
        headers: {
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("เปลี่ยนรหัสผ่านสำเร็จ!");
        
        // Don't sign out - keep the session and redirect to dashboard
        navigate(location.state?.returnTo || "/dashboard");
      } else {
        setError(data.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
      }
    } catch (err: any) {
      console.error("Password change error:", err);
      
      // Check if error is due to password breach
      if (isPasswordBreachError(err)) {
        setShowBreachAlert(true);
        setError("");
        
        // Log password breach detection event
        const { data: { user } } = await supabase.auth.getUser();
        await logPasswordBreachEvent({
          userId: user?.id,
          email: user?.email,
          context: 'password_change',
        });
      } else {
        setError(err.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
        setShowBreachAlert(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            เปลี่ยนรหัสผ่าน
          </CardTitle>
          <CardDescription>
            จำเป็นต้องเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งานระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {showBreachAlert && <PasswordBreachAlert />}
            
            {!showBreachAlert && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  กรุณาตั้งรหัสผ่านใหม่ที่แข็งแรงและปลอดภัย
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="current">รหัสผ่านปัจจุบัน (รหัสชั่วคราว)</Label>
              <div className="relative">
                <Input
                  id="current"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านชั่วคราว"
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrent(!showCurrent)}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">รหัสผ่านใหม่</Label>
              <div className="relative">
                <Input
                  id="new"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่"
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNew(!showNew)}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">ยืนยันรหัสผ่านใหม่</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Password Strength Meter */}
            <PasswordStrengthMeter
              strength={passwordStrength}
              password={newPassword}
              confirmPassword={confirmPassword}
            />

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !Object.values(passwordStrength.checks).every(v => v)}
            >
              {loading ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่าน"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}