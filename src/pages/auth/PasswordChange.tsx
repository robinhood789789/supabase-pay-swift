import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Eye, EyeOff, AlertCircle, CheckCircle, Lock } from "lucide-react";
import { getCSRFToken } from "@/lib/security/csrf";

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
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "",
    color: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Update password strength checks
    const checks = {
      length: newPassword.length >= 12,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*]/.test(newPassword),
      match: newPassword.length > 0 && newPassword === confirmPassword,
    };
    setPasswordChecks(checks);

    // Calculate password strength
    if (newPassword.length === 0) {
      setPasswordStrength({ score: 0, label: "", color: "" });
      return;
    }

    let score = 0;
    
    // Length scoring (0-40 points)
    if (newPassword.length >= 12) score += 20;
    if (newPassword.length >= 16) score += 10;
    if (newPassword.length >= 20) score += 10;
    
    // Complexity scoring (60 points)
    if (checks.uppercase) score += 15;
    if (checks.lowercase) score += 15;
    if (checks.number) score += 15;
    if (checks.special) score += 15;
    
    // Variety bonus (check for multiple different characters)
    const uniqueChars = new Set(newPassword).size;
    if (uniqueChars >= 8) score += 5;
    if (uniqueChars >= 12) score += 5;

    // Sequential or repeated character penalty
    const hasSequential = /(.)\1{2,}/.test(newPassword); // 3+ repeated chars
    if (hasSequential) score -= 10;

    // Determine strength level
    let label = "";
    let color = "";
    
    if (score < 30) {
      label = "อย่อนมาก";
      color = "text-red-600";
    } else if (score < 50) {
      label = "อ่อน";
      color = "text-orange-600";
    } else if (score < 70) {
      label = "ปานกลาง";
      color = "text-yellow-600";
    } else if (score < 85) {
      label = "แข็งแกร่ง";
      color = "text-green-600";
    } else {
      label = "แข็งแกร่งมาก";
      color = "text-emerald-600";
    }

    setPasswordStrength({ score: Math.min(100, Math.max(0, score)), label, color });
  }, [newPassword, confirmPassword]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if password change is required
    const { data: profile } = await supabase
      .from("profiles")
      .select("requires_password_change, totp_enabled")
      .eq("id", user.id)
      .single();

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

    if (!Object.values(passwordChecks).every(v => v)) {
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
        
        // Sign out and redirect to login
        await supabase.auth.signOut();
        navigate("/auth", { state: { message: "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง" } });
      } else {
        setError(data.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
      }
    } catch (err: any) {
      console.error("Password change error:", err);
      setError(err.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
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
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                กรุณาตั้งรหัสผ่านใหม่ที่แข็งแรงและปลอดภัย
              </AlertDescription>
            </Alert>

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
              
              {/* Password Strength Meter */}
              {newPassword && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ความแข็งแกร่ง:</span>
                    <span className={`font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordStrength.score < 30
                          ? "bg-red-500"
                          : passwordStrength.score < 50
                          ? "bg-orange-500"
                          : passwordStrength.score < 70
                          ? "bg-yellow-500"
                          : passwordStrength.score < 85
                          ? "bg-green-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                </div>
              )}
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

            <div className="space-y-2 text-sm">
              <p className="font-medium">เงื่อนไขรหัสผ่าน:</p>
              <div className="space-y-1">
                <div className={`flex items-center gap-2 ${passwordChecks.length ? "text-green-600" : "text-muted-foreground"}`}>
                  {passwordChecks.length ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2" />}
                  <span>อย่างน้อย 12 ตัวอักษร</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordChecks.uppercase ? "text-green-600" : "text-muted-foreground"}`}>
                  {passwordChecks.uppercase ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2" />}
                  <span>มีตัวพิมพ์ใหญ่ (A-Z)</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordChecks.lowercase ? "text-green-600" : "text-muted-foreground"}`}>
                  {passwordChecks.lowercase ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2" />}
                  <span>มีตัวพิมพ์เล็ก (a-z)</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordChecks.number ? "text-green-600" : "text-muted-foreground"}`}>
                  {passwordChecks.number ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2" />}
                  <span>มีตัวเลข (0-9)</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordChecks.special ? "text-green-600" : "text-muted-foreground"}`}>
                  {passwordChecks.special ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2" />}
                  <span>มีอักขระพิเศษ (!@#$%^&*)</span>
                </div>
                {confirmPassword && (
                  <div className={`flex items-center gap-2 ${passwordChecks.match ? "text-green-600" : "text-red-600"}`}>
                    {passwordChecks.match ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>รหัสผ่านตรงกัน</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !Object.values(passwordChecks).every(v => v)}
            >
              {loading ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่าน"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}