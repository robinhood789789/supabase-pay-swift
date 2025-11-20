import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { TemporaryCodeDisplay } from "@/components/TemporaryCodeDisplay";

interface CredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentials: {
    temp_password?: string;
    invite_link?: string;
    email?: string;
    public_id?: string;
    display_name: string;
    invitation_code?: string;
    code_id?: string;
    code_expires_at?: string;
    shareholder_id?: string;
  };
}

export function CredentialsDialog({ open, onOpenChange, credentials }: CredentialsDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const userId = credentials.public_id || credentials.email || '';
  const userIdLabel = credentials.public_id ? 'Public ID' : 'อีเมล (User ID)';

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(credentials.temp_password);
    setCopiedPassword(true);
    toast.success("คัดลอกรหัสผ่านแล้ว");
    setTimeout(() => setCopiedPassword(false), 3000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(credentials.invite_link);
    setCopiedLink(true);
    toast.success("คัดลอกลิงก์เชิญแล้ว");
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleDownload = () => {
    const content = `
บัญชีผู้ใช้
=====================================

ชื่อแสดงผล: ${credentials.display_name}
${userIdLabel}: ${userId}

${credentials.invitation_code ? `รหัสเชิญ (Invitation Code): ${credentials.invitation_code}` : ''}
${credentials.temp_password ? `รหัสผ่านชั่วคราว: ${credentials.temp_password}` : ''}

${credentials.invite_link ? `ลิงก์เชิญเข้าสู่ระบบ:\n${credentials.invite_link}` : ''}

⚠️ คำเตือนด้านความปลอดภัย:
- ${credentials.invitation_code ? 'ใช้รหัสเชิญที่ /auth/claim-code เพื่อตั้งรหัสผ่านใหม่' : 'รหัสผ่านชั่วคราวนี้ใช้ได้เพียงครั้งเดียว'}
- ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก
- ส่งข้อมูลนี้ผ่านช่องทางที่ปลอดภัยเท่านั้น
- ${credentials.invitation_code ? 'รหัสเชิญมีอายุ 72 ชั่วโมง' : 'รหัสผ่านชั่วคราวนี้ต้องเปลี่ยนทันทีเมื่อเข้าสู่ระบบ'}

สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user-credentials-${userId}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ดาวน์โหลดข้อมูลแล้ว");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            สร้างบัญชีผู้ใช้สำเร็จ
          </DialogTitle>
          <DialogDescription>
            ข้อมูลต่อไปนี้จะแสดงครั้งเดียว - กรุณาบันทึกและส่งต่อให้ผู้ใช้อย่างปลอดภัย
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Banner */}
          <div className="rounded-lg border border-warning bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm">คำเตือนด้านความปลอดภัย</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• ข้อมูลนี้จะแสดงครั้งเดียวเท่านั้น</li>
                  <li>• ส่งข้อมูลให้ผู้ใช้ผ่านช่องทางที่ปลอดภัย</li>
                  <li>• ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก</li>
                  <li>• {credentials.invitation_code ? 'รหัสเชิญมีอายุ 72 ชั่วโมง' : 'รหัสผ่านชั่วคราวนี้ใช้ได้เพียงครั้งเดียว'}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อแสดงผล</Label>
              <Input value={credentials.display_name} readOnly />
            </div>

            <div className="space-y-2">
              <Label>{userIdLabel}</Label>
              <Input value={userId} readOnly className="font-mono" />
            </div>

            <Separator />

            {/* Invitation Code (New System) */}
            {credentials.invitation_code && credentials.code_expires_at && (
              <>
                <TemporaryCodeDisplay
                  code={credentials.invitation_code}
                  codeId={credentials.code_id || ''}
                  expiresAt={credentials.code_expires_at}
                  userId={credentials.shareholder_id || ''}
                />
                <Separator />
              </>
            )}

            {/* Temp Password */}
            {credentials.temp_password && (
              <>
                <div className="space-y-2">
                  <Label>รหัสผ่านชั่วคราว</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={credentials.temp_password}
                        readOnly
                        className="pr-10 font-mono"
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
                    <Button onClick={handleCopyPassword} variant="outline">
                      {copiedPassword ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ผู้ใช้ต้องเปลี่ยนรหัสผ่านนี้เมื่อเข้าสู่ระบบครั้งแรก
                  </p>
                </div>
                <Separator />
              </>
            )}

            {/* Invite Link */}
            {credentials.invite_link && (
              <div className="space-y-2">
                <Label>ลิงก์เชิญเข้าสู่ระบบ</Label>
                <div className="flex gap-2">
                  <Input
                    value={credentials.invite_link}
                    readOnly
                    className="flex-1 text-xs"
                  />
                  <Button onClick={handleCopyLink} variant="outline">
                    {copiedLink ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {credentials.invitation_code 
                    ? `ผู้ใช้สามารถใช้รหัสเชิญที่หน้า /auth/claim-code`
                    : `ลิงก์มีอายุ 72 ชั่วโมง - ${credentials.email ? `อีเมลเชิญถูกส่งไปยัง ${credentials.email} แล้ว` : 'ส่งลิงก์ให้ผู้ใช้อย่างปลอดภัย'}`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button onClick={handleDownload} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              ดาวน์โหลดเป็นไฟล์ .txt
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              เข้าใจแล้ว - ปิดหน้าต่าง
            </Button>
          </div>

          {/* Final Warning */}
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-xs text-center text-muted-foreground">
              เมื่อปิดหน้าต่างนี้ คุณจะไม่สามารถดูข้อมูลนี้ได้อีก - กรุณาบันทึกข้อมูลก่อนปิด
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
