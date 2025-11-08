import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlatformOverview() {
  return (
    <main className="w-full">
      <header className="px-6 pt-6">
        <h1 className="text-3xl font-bold text-foreground">Platform Admin Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">สรุปภาพรวมระบบและทางลัดการจัดการ</p>
      </header>

      <section className="p-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ยินดีต้อนรับสู่ศูนย์ควบคุมแพลตฟอร์ม</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            ใช้เมนูด้านซ้ายเพื่อเข้าถึงการจัดการพาร์ทเนอร์ ผู้ให้บริการ การชำระเงิน และความปลอดภัยของระบบ
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            - ใช้เมนู Providers เพื่อตั้งค่าเชื่อมต่อผู้ให้บริการ
            <br />- ตรวจสอบสถานะระบบได้ที่ Status
            <br />- ตั้งค่า Security เพื่อกำหนดนโยบาย MFA/Password
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
