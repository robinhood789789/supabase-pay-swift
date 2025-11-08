import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TwoFactorSetup } from "@/components/security/TwoFactorSetup";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ShareholderSettings() {
  const { user } = useAuth();

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">ตั้งค่า</h1>
        <p className="text-sm sm:text-base text-white/80">การตั้งค่าบัญชีและความปลอดภัย Shareholder</p>
      </div>

      {/* Account Information */}
      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-blue-500">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            ข้อมูลบัญชี
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">ข้อมูลพื้นฐานของบัญชี Shareholder</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
              <span className="text-xs sm:text-sm font-medium">อีเมล</span>
              <span className="text-xs sm:text-sm text-muted-foreground break-all">{user?.email}</span>
            </div>
            <Separator />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
              <span className="text-xs sm:text-sm font-medium">ประเภทบัญชี</span>
              <Badge variant="secondary" className="text-xs w-fit">Shareholder</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg sm:text-xl font-semibold">ความปลอดภัย</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            จัดการการยืนยันตัวตนแบบสองขั้นตอนเพื่อความปลอดภัยที่มากขึ้น
          </p>
        </div>
        <TwoFactorSetup />
      </div>
    </div>
  );
}
