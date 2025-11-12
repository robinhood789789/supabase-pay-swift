import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Shield,
  AlertTriangle,
  ArrowLeft,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const MfaTroubleshooting = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [clockOffset, setClockOffset] = useState<number | null>(null);
  const [isCheckingClock, setIsCheckingClock] = useState(false);
  const [isReEnrolling, setIsReEnrolling] = useState(false);

  // Fetch user's MFA status
  const { data: profile } = useQuery({
    queryKey: ["profile-mfa", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("totp_enabled, totp_secret, email, public_id")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check clock sync on mount
  useEffect(() => {
    checkClockSync();
  }, []);

  const checkClockSync = async () => {
    setIsCheckingClock(true);
    try {
      const clientTime = Date.now();
      const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
      const data = await response.json();
      const serverTime = new Date(data.datetime).getTime();
      const offset = Math.abs(clientTime - serverTime) / 1000; // seconds
      setClockOffset(offset);
    } catch (error) {
      console.error("Clock sync check failed:", error);
      toast.error("ไม่สามารถตรวจสอบเวลาได้");
    } finally {
      setIsCheckingClock(false);
    }
  };

  const disableMfaMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("mfa-disable");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-mfa"] });
      toast.success("ปิดการใช้งาน 2FA สำเร็จ");
    },
    onError: (error: any) => {
      toast.error("เกิดข้อผิดพลาด", {
        description: error.message || "ไม่สามารถปิดการใช้งาน 2FA ได้",
      });
    },
  });

  const handleQuickReEnroll = async () => {
    if (!profile?.totp_enabled) {
      toast.error("คุณยังไม่ได้เปิดใช้งาน 2FA");
      return;
    }

    setIsReEnrolling(true);
    try {
      // Step 1: Disable MFA
      await disableMfaMutation.mutateAsync();
      
      // Step 2: Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Navigate to Settings with security tab
      toast.success("กำลังนำคุณไปยังหน้าตั้งค่า 2FA ใหม่...");
      setTimeout(() => {
        navigate("/settings?tab=security");
      }, 1500);
    } catch (error) {
      console.error("Re-enrollment failed:", error);
    } finally {
      setIsReEnrolling(false);
    }
  };

  const getClockStatusColor = () => {
    if (clockOffset === null) return "secondary";
    if (clockOffset < 30) return "default"; // Good
    if (clockOffset < 60) return "warning"; // Warning
    return "destructive"; // Bad
  };

  const getClockStatusText = () => {
    if (clockOffset === null) return "กำลังตรวจสอบ...";
    if (clockOffset < 30) return "ตรงเวลา";
    if (clockOffset < 60) return "เวลาต่างกันเล็กน้อย";
    return "เวลาต่างกันมาก";
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings?tab=security")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">แก้ไขปัญหา 2FA</h1>
            <p className="text-muted-foreground">
              แก้ไขปัญหาการยืนยันตัวตนด้วย Two-Factor Authentication
            </p>
          </div>
        </div>

        {/* MFA Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              สถานะ 2FA ของคุณ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Public ID</p>
                <p className="text-muted-foreground">{profile?.public_id || "N/A"}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm font-medium">สถานะ 2FA</p>
                <Badge variant={profile?.totp_enabled ? "default" : "secondary"}>
                  {profile?.totp_enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clock Sync Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              ตรวจสอบความตรงต่อเวลา
            </CardTitle>
            <CardDescription>
              TOTP codes ต้องการเวลาที่แม่นยำ ถ้าเวลาในเครื่องของคุณไม่ตรงกับเซิร์ฟเวอร์ code จะไม่ถูกต้อง
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
              <div className="flex items-center gap-3">
                {clockOffset !== null && clockOffset < 60 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium">สถานะเวลา</p>
                  <p className="text-sm text-muted-foreground">
                    {clockOffset !== null ? `เวลาต่างกัน ${clockOffset.toFixed(1)} วินาที` : "กำลังตรวจสอบ..."}
                  </p>
                </div>
              </div>
              <Badge variant={getClockStatusColor() as any}>
                {getClockStatusText()}
              </Badge>
            </div>

            <Button
              onClick={checkClockSync}
              disabled={isCheckingClock}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingClock ? 'animate-spin' : ''}`} />
              ตรวจสอบใหม่
            </Button>

            {clockOffset !== null && clockOffset >= 60 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>เวลาไม่ตรงกัน!</AlertTitle>
                <AlertDescription>
                  เวลาในเครื่องของคุณต่างจากเซิร์ฟเวอร์มากกว่า 1 นาที 
                  กรุณาตั้งค่าเวลาอัตโนมัติในเครื่องของคุณ
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Quick Re-enroll */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              ตั้งค่า 2FA ใหม่อย่างรวดเร็ว
            </CardTitle>
            <CardDescription>
              หากคุณไม่สามารถเข้าสู่ระบบด้วย 2FA ได้ วิธีแก้ที่ดีที่สุดคือตั้งค่าใหม่ทั้งหมด
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>วิธีการทำงาน</AlertTitle>
              <AlertDescription className="space-y-2 mt-2">
                <p>1. ปิดการใช้งาน 2FA ปัจจุบัน</p>
                <p>2. นำคุณไปยังหน้าตั้งค่า Security</p>
                <p>3. เปิดใช้งาน 2FA ใหม่และสแกน QR code ใหม่ในแอพ authenticator</p>
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleQuickReEnroll}
              disabled={!profile?.totp_enabled || isReEnrolling}
              className="w-full"
              size="lg"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isReEnrolling ? 'animate-spin' : ''}`} />
              {isReEnrolling ? "กำลังดำเนินการ..." : "ตั้งค่า 2FA ใหม่"}
            </Button>

            {!profile?.totp_enabled && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  คุณยังไม่ได้เปิดใช้งาน 2FA กรุณาเปิดใช้งานที่หน้า Settings &gt; Security ก่อน
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Troubleshooting Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              ขั้นตอนแก้ไขปัญหา
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium">ตรวจสอบเวลาในเครื่อง</p>
                  <p className="text-sm text-muted-foreground">
                    ตรวจสอบว่าเวลาในเครื่องของคุณถูกต้องและเปิดการตั้งค่าเวลาอัตโนมัติ
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium">ตรวจสอบแอพ Authenticator</p>
                  <p className="text-sm text-muted-foreground">
                    ใช้แอพที่ถูกต้อง เช่น Google Authenticator, Microsoft Authenticator, Authy
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium">ตรวจสอบรหัสที่ป้อน</p>
                  <p className="text-sm text-muted-foreground">
                    ป้อนรหัส 6 หลักที่แสดงในแอพ authenticator (ใหม่ทุก 30 วินาที)
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  4
                </div>
                <div className="flex-1">
                  <p className="font-medium">ลองใช้ Recovery Code</p>
                  <p className="text-sm text-muted-foreground">
                    หากยังไม่ได้ลองใช้ recovery code (10 codes ที่ได้ตอนตั้งค่า 2FA)
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  5
                </div>
                <div className="flex-1">
                  <p className="font-medium">ตั้งค่าใหม่ทั้งหมด</p>
                  <p className="text-sm text-muted-foreground">
                    หากยังแก้ไม่ได้ ให้ใช้ปุ่ม "ตั้งค่า 2FA ใหม่" ด้านบน
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Common Issues */}
        <Card>
          <CardHeader>
            <CardTitle>ปัญหาที่พบบ่อย</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <details className="group">
                <summary className="cursor-pointer font-medium flex items-center gap-2 hover:text-primary">
                  <span>❌</span> Invalid verification code
                </summary>
                <div className="mt-2 ml-6 text-sm text-muted-foreground space-y-2">
                  <p><strong>สาเหตุ:</strong> Secret key ไม่ตรงกัน หรือเวลาไม่ถูกต้อง</p>
                  <p><strong>วิธีแก้:</strong> ตั้งค่า 2FA ใหม่และสแกน QR code ใหม่</p>
                </div>
              </details>

              <Separator />

              <details className="group">
                <summary className="cursor-pointer font-medium flex items-center gap-2 hover:text-primary">
                  <span>⏰</span> รหัสหมดอายุเร็วเกินไป
                </summary>
                <div className="mt-2 ml-6 text-sm text-muted-foreground space-y-2">
                  <p><strong>สาเหตุ:</strong> เวลาในเครื่องไม่ตรง</p>
                  <p><strong>วิธีแก้:</strong> เปิดการตั้งค่าเวลาอัตโนมัติและซิงค์เวลา</p>
                </div>
              </details>

              <Separator />

              <details className="group">
                <summary className="cursor-pointer font-medium flex items-center gap-2 hover:text-primary">
                  <span>📱</span> แอพ authenticator ไม่มีบัญชีนี้
                </summary>
                <div className="mt-2 ml-6 text-sm text-muted-foreground space-y-2">
                  <p><strong>สาเหตุ:</strong> ลบหรือไม่ได้บันทึก QR code</p>
                  <p><strong>วิธีแก้:</strong> ใช้ปุ่ม "ตั้งค่า 2FA ใหม่" เพื่อสร้าง QR code ใหม่</p>
                </div>
              </details>
            </div>
          </CardContent>
        </Card>

        {/* Back to Settings */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => navigate("/settings?tab=security")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับไปหน้าตั้งค่า
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MfaTroubleshooting;
