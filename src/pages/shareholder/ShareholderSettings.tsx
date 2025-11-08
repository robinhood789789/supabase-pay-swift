import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TwoFactorSetup } from "@/components/security/TwoFactorSetup";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ShareholderSettings() {
  const { user } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ตั้งค่า</h1>
        <p className="text-muted-foreground">การตั้งค่าบัญชีและความปลอดภัย Shareholder</p>
      </div>

      {/* Account Information */}
      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            ข้อมูลบัญชี
          </CardTitle>
          <CardDescription>ข้อมูลพื้นฐานของบัญชี Shareholder</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">อีเมล</span>
              <span className="text-sm text-muted-foreground">{user?.email}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ประเภทบัญชี</span>
              <Badge variant="secondary">Shareholder</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-xl font-semibold">ความปลอดภัย</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            จัดการการยืนยันตัวตนแบบสองขั้นตอนเพื่อความปลอดภัยที่มากขึ้น
          </p>
        </div>
        <TwoFactorSetup />
      </div>
    </div>
  );
}
