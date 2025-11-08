import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { RequireTenant } from '@/components/RequireTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Book, 
  Shield, 
  Users, 
  Crown,
  Briefcase,
  Settings,
  Code,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  DollarSign
} from 'lucide-react';

const TestingGuide = () => {
  const [activeRole, setActiveRole] = useState('overview');

  const roles = [
    { id: 'overview', name: 'ภาพรวม', icon: Book, color: 'bg-blue-500' },
    { id: 'super-admin', name: 'Super Admin', icon: Shield, color: 'bg-purple-500' },
    { id: 'owner', name: 'Owner', icon: Crown, color: 'bg-amber-500' },
    { id: 'manager', name: 'Manager', icon: Briefcase, color: 'bg-green-500' },
    { id: 'finance', name: 'Finance', icon: DollarSign, color: 'bg-blue-500' },
    { id: 'developer', name: 'Developer', icon: Code, color: 'bg-indigo-500' },
  ];

  const TestSection = ({ title, items }: { title: string; items: string[] }) => (
    <div className="space-y-2 mb-6">
      <h4 className="font-semibold text-lg flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        {title}
      </h4>
      <ul className="space-y-1 ml-7">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const PermissionAlert = ({ canDo, cannotDo }: { canDo: string[]; cannotDo: string[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertDescription>
          <div className="font-semibold mb-2">สิทธิ์ที่มี:</div>
          <ul className="space-y-1 text-xs">
            {canDo.map((item, idx) => (
              <li key={idx}>✓ {item}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
      <Alert className="border-red-500/50 bg-red-500/10">
        <XCircle className="h-4 w-4 text-red-500" />
        <AlertDescription>
          <div className="font-semibold mb-2">สิทธิ์ที่ไม่มี:</div>
          <ul className="space-y-1 text-xs">
            {cannotDo.map((item, idx) => (
              <li key={idx}>✗ {item}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Book className="w-8 h-8" />
              คู่มือการทดสอบบัญชีผู้ใช้
            </h1>
            <p className="text-muted-foreground mt-2">
              คู่มือการทดสอบครบถ้วนสำหรับทุกบทบาทในระบบ Payment Gateway
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              เอกสารนี้จัดทำขึ้นเพื่อช่วยในการทดสอบการทำงานของบัญชีผู้ใช้แต่ละบทบาท 
              เพื่อให้มั่นใจว่าระบบมีความปลอดภัยและทำงานตามที่ออกแบบไว้
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Navigation */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>เลือกบทบาท</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        onClick={() => setActiveRole(role.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          activeRole === role.id
                            ? 'bg-primary/10 border-primary shadow-sm'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`${role.color} p-2 rounded-lg`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-medium">{role.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Main Content */}
            <Card className="lg:col-span-3">
              <CardContent className="pt-6">
                <ScrollArea className="h-[700px] pr-4">
                  {activeRole === 'overview' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold mb-4">ภาพรวมโครงสร้างบัญชี</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card className="border-purple-500/50">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-purple-500" />
                                ฝั่งระบบ (System Side)
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <Badge variant="secondary" className="bg-purple-500 text-white">
                                  Super Admin
                                </Badge>
                                <p className="text-sm text-muted-foreground">
                                  ผู้สร้างและควบคุมระบบทั้งหมด มีสิทธิ์เข้าถึงทุก tenant
                                </p>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-amber-500/50">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-amber-500" />
                                ฝั่งผู้ใช้งาน (User Side)
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <Badge variant="secondary" className="bg-amber-500 text-white">
                                  Owner
                                </Badge>
                                <Badge variant="secondary" className="bg-green-500 text-white">
                                  Manager
                                </Badge>
                                <Badge variant="secondary" className="bg-blue-500 text-white">
                                  Finance
                                </Badge>
                                <Badge variant="secondary" className="bg-indigo-500 text-white">
                                  Developer
                                </Badge>
                                <p className="text-sm text-muted-foreground mt-2">
                                  ผู้ใช้งานภายในองค์กร แต่ละบทบาทมีสิทธิ์แตกต่างกัน
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xl font-bold mb-4">วัตถุประสงค์การทดสอบ</h3>
                        <div className="space-y-3">
                          <Alert>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <AlertDescription>
                              ✅ ทุก role มีสิทธิ์ตามที่ออกแบบไว้
                            </AlertDescription>
                          </Alert>
                          <Alert>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <AlertDescription>
                              ✅ ไม่มี permission escalation vulnerabilities
                            </AlertDescription>
                          </Alert>
                          <Alert>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <AlertDescription>
                              ✅ Tenant isolation ทำงานถูกต้อง
                            </AlertDescription>
                          </Alert>
                          <Alert>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <AlertDescription>
                              ✅ Security features ทำงานครบถ้วน
                            </AlertDescription>
                          </Alert>
                          <Alert>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <AlertDescription>
                              ✅ User experience เหมาะสมกับแต่ละบทบาท
                            </AlertDescription>
                          </Alert>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xl font-bold mb-4">Best Practices</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">1.</span>
                            <span><strong>ทดสอบตามลำดับ:</strong> เริ่มจาก Super Admin → Owner → Manager → Finance → Developer</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">2.</span>
                            <span><strong>ใช้ข้อมูลจริง:</strong> สร้างข้อมูลทดสอบที่ใกล้เคียงกับการใช้งานจริง</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">3.</span>
                            <span><strong>ทดสอบ Edge Cases:</strong> ลองกรณีที่มูลค่าเงินสูง, จำนวนข้อมูลมาก</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">4.</span>
                            <span><strong>ทดสอบ Negative Scenarios:</strong> พยายามทำสิ่งที่ไม่ควรทำได้</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">5.</span>
                            <span><strong>บันทึกผล:</strong> จดบันทึกทุก test case พร้อมผลลัพธ์</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeRole === 'super-admin' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                          <Shield className="w-7 h-7 text-purple-500" />
                          Super Admin
                        </h2>
                        <p className="text-muted-foreground">
                          ผู้สร้างและควบคุมระบบทั้งหมด มีสิทธิ์ควบคุมทุกอย่างในระบบ รวมถึงการจัดการ tenant ทั้งหมด
                        </p>
                      </div>

                      <TestSection
                        title="การเข้าสู่ระบบ"
                        items={[
                          'เข้าสู่ระบบด้วย super admin credentials',
                          'ตรวจสอบว่าระบบแสดง role เป็น "Super Admin"',
                          'ยืนยันว่าไม่ต้องเลือก tenant เนื่องจาก super admin มีสิทธิ์เข้าถึงทุก tenant',
                        ]}
                      />

                      <TestSection
                        title="หน้าพิเศษสำหรับ Super Admin"
                        items={[
                          '/admin/super-admin-dashboard - Dashboard สำหรับ Super Admin',
                          '/admin/tenant-management - จัดการ Tenant ทั้งหมด',
                          '/admin/provision-merchant - สร้าง Merchant ใหม่',
                          '/admin/platform-security - ความปลอดภัยระดับ Platform',
                          '/admin/platform-audit - ตรวจสอบ Audit ทั้งระบบ',
                          '/workbench - Admin Workbench',
                        ]}
                      />

                      <TestSection
                        title="การจัดการ Tenant"
                        items={[
                          'ดูรายการ Tenant ทั้งหมดในระบบ',
                          'สร้าง Tenant ใหม่',
                          'แก้ไขข้อมูล Tenant',
                          'ปิดการใช้งาน/เปิดการใช้งาน Tenant',
                          'ดู Audit Log ของทุก Tenant',
                        ]}
                      />

                      <TestSection
                        title="การดำเนินการพิเศษ"
                        items={[
                          'Global Refund Freeze - หยุดการคืนเงินทั้งระบบ',
                          'System Deposit/Withdrawal - ทำธุรกรรมระดับระบบ',
                          'Access Cross-Tenant Audit - เข้าถึงข้อมูลข้ามองค์กร',
                          'Bootstrap Super Admin - สร้าง super admin แรกของระบบ',
                        ]}
                      />

                      <Alert className="border-amber-500/50 bg-amber-500/10">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <AlertDescription>
                          <strong>หมายเหตุ:</strong> Super Admin มีสิทธิ์สูงสุด ควรใช้ระมัดระวังและทดสอบในสภาพแวดล้อม staging ก่อน
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {activeRole === 'owner' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                          <Crown className="w-7 h-7 text-amber-500" />
                          Owner
                        </h2>
                        <p className="text-muted-foreground">
                          เจ้าขององค์กร มีสิทธิ์ควบคุมทุกอย่างภายใน Tenant ของตนเอง
                        </p>
                      </div>

                      <PermissionAlert
                        canDo={[
                          'ดู Dashboard และสถิติทั้งหมด',
                          'จัดการ Payments, Refunds, Settlements',
                          'จัดการลูกค้าและ KYC',
                          'จัดการผู้ใช้ในองค์กร (เชิญ/ลบ/แก้ไขสิทธิ์)',
                          'ตั้งค่าระบบทั้งหมด',
                          'สร้าง/จัดการ API Keys',
                          'ทำ System Deposit/Withdrawal',
                          'อนุมัติธุรกรรมทั้งหมด',
                        ]}
                        cannotDo={[
                          'เข้าถึงข้อมูลของ Tenant อื่น',
                          'จัดการ Tenant อื่น',
                          'เข้าถึงหน้า Super Admin',
                        ]}
                      />

                      <TestSection
                        title="Dashboard และภาพรวม"
                        items={[
                          'ดูสถิติการชำระเงินรวม',
                          'ดูยอดขายประจำวัน/สัปดาห์/เดือน',
                          'ดูรายการธุรกรรมล่าสุด',
                          'ดู Payment Success Rate',
                          'ดูจำนวนลูกค้าทั้งหมด',
                        ]}
                      />

                      <TestSection
                        title="การจัดการการชำระเงิน"
                        items={[
                          'ดูรายการ Payments ทั้งหมด',
                          'ค้นหา/กรอง Payments',
                          'ดูรายละเอียด Payment แต่ละรายการ',
                          'Export ข้อมูล Payments (ต้องมี MFA)',
                          'สร้าง Payment Links',
                          'ปิดการใช้งาน Payment Links',
                        ]}
                      />

                      <TestSection
                        title="การจัดการผู้ใช้ในองค์กร"
                        items={[
                          'เชิญผู้ใช้ใหม่ (Manager/Finance/Developer)',
                          'กำหนด Role และ Permissions',
                          'แก้ไขสิทธิ์ผู้ใช้',
                          'ลบผู้ใช้ออกจากองค์กร',
                          'ดู Activity Log ของทีม',
                        ]}
                      />

                      <TestSection
                        title="การตั้งค่า Security"
                        items={[
                          'ตั้งค่า 2FA สำหรับตนเอง',
                          'บังคับใช้ 2FA สำหรับทีม',
                          'ตั้งค่า Security Policy ขององค์กร',
                          'จัดการ Session Timeout',
                          'สร้าง/ลบ API Keys',
                          'ตั้งค่า API Rate Limits',
                        ]}
                      />

                      <TestSection
                        title="การดำเนินการพิเศษของ Owner"
                        items={[
                          'System Deposit - เติมเงินเข้าระบบ',
                          'System Withdrawal - ถอนเงินออกจากระบบ',
                          'อนุมัติธุรกรรมขนาดใหญ่',
                          'ตั้งค่า Guardrails',
                          'อนุมัติ Large Exports (>10,000 records)',
                        ]}
                      />
                    </div>
                  )}

                  {activeRole === 'manager' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                          <Briefcase className="w-7 h-7 text-green-500" />
                          Manager
                        </h2>
                        <p className="text-muted-foreground">
                          มีสิทธิ์จัดการงานประจำวันและอนุมัติธุรกรรมปกติ แต่ไม่มีสิทธิ์ในการตั้งค่าระบบหรือจัดการผู้ใช้
                        </p>
                      </div>

                      <PermissionAlert
                        canDo={[
                          'ดู Dashboard และสถิติ',
                          'ดูและจัดการ Payments',
                          'สร้างและอนุมัติ Refunds (มูลค่าปกติ)',
                          'ดู Settlements',
                          'ดูและจัดการ Customers',
                          'สร้าง Payment Links',
                          'ดู Reports',
                          'ดู Activity History',
                        ]}
                        cannotDo={[
                          'เข้าถึงหน้า Settings',
                          'จัดการผู้ใช้ (เชิญ/ลบ)',
                          'สร้าง/ลบ API Keys',
                          'จัดการ Webhooks',
                          'ตั้งค่า Payment Gateways',
                          'ทำ System Deposit/Withdrawal',
                          'แก้ไข Security Policies',
                          'Export ข้อมูลขนาดใหญ่ (>1,000 records)',
                        ]}
                      />

                      <TestSection
                        title="การทดสอบสิทธิ์การเข้าถึง"
                        items={[
                          'ดู Dashboard และสถิติ → ควรเห็นได้',
                          'เข้าถึง Payments → ควรเข้าถึงได้',
                          'พยายามเข้าถึง /settings → ควรถูกปฏิเสธ',
                          'พยายามเข้าถึง /admin/users → ควรถูกปฏิเสธ',
                          'พยายามสร้าง API Key → ควรได้ 403 Forbidden',
                        ]}
                      />

                      <TestSection
                        title="การทดสอบ Approvals"
                        items={[
                          'สร้าง Refund Request',
                          'อนุมัติ Refund มูลค่าปกติ (<10,000 บาท) → ควรสำเร็จ',
                          'พยายามอนุมัติ Refund มูลค่าสูง (>50,000 บาท) → ควรต้องรอ Owner',
                          'ตรวจสอบว่า Approval workflow ทำงานถูกต้อง',
                        ]}
                      />

                      <Alert className="border-blue-500/50 bg-blue-500/10">
                        <Info className="h-4 w-4 text-blue-500" />
                        <AlertDescription>
                          <strong>การทดสอบ Permission Gates:</strong> ให้ลองเข้าถึง URL ต่างๆ โดยตรง เพื่อยืนยันว่าระบบป้องกันการเข้าถึงที่ไม่ได้รับอนุญาต
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {activeRole === 'finance' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                          <DollarSign className="w-7 h-7 text-green-500" />
                          Finance
                        </h2>
                        <p className="text-muted-foreground">
                          มีสิทธิ์ในการเติมเงินและถอนเงินให้กับลูกค้าขององค์กร รวมถึงดูข้อมูลทางการเงินพื้นฐาน
                        </p>
                      </div>

                      <PermissionAlert
                        canDo={[
                          'ดู Dashboard และสถิติทางการเงิน',
                          'สร้างคำขอฝากเงิน (Deposit Request)',
                          'สร้างคำขอถอนเงิน (Withdrawal Request)',
                          'ดู Payments',
                          'ดู Customers',
                          'ดู Settlements',
                          'ดู Reports',
                        ]}
                        cannotDo={[
                          'อนุมัติ Deposits/Withdrawals',
                          'สร้าง/จัดการ API Keys',
                          'จัดการ Webhooks',
                          'เชิญผู้ใช้ใหม่',
                          'แก้ไขตั้งค่าระบบ',
                          'ทำ Refunds',
                        ]}
                      />

                      <TestSection
                        title="การทดสอบการฝากเงิน"
                        items={[
                          'ไปที่หน้า /deposit-list',
                          'สร้างคำขอฝากเงินใหม่ → ควรสำเร็จ',
                          'ระบุข้อมูลลูกค้า (ชื่อ, จำนวนเงิน)',
                          'ตรวจสอบสถานะคำขอ',
                          'ดูประวัติการฝากเงิน',
                        ]}
                      />

                      <TestSection
                        title="การทดสอบการถอนเงิน"
                        items={[
                          'ไปที่หน้า /withdrawal-list',
                          'สร้างคำขอถอนเงินใหม่ → ควรสำเร็จ',
                          'ระบุข้อมูลธนาคาร (ชื่อ, เลขบัญชี)',
                          'ตรวจสอบสถานะคำขอ',
                          'ดูประวัติการถอนเงิน',
                        ]}
                      />

                      <TestSection
                        title="การทดสอบข้อจำกัด"
                        items={[
                          'พยายามเข้าถึง /settings → ควรถูกปฏิเสธ',
                          'พยายามสร้าง API Key → ควรถูกปฏิเสธ',
                          'พยายามจัดการ Webhooks → ควรถูกปฏิเสธ',
                          'พยายามเชิญผู้ใช้ใหม่ → ควรถูกปฏิเสธ',
                        ]}
                      />

                      <Alert className="border-green-500/50 bg-green-500/10">
                        <Info className="h-4 w-4 text-green-500" />
                        <AlertDescription>
                          <strong>หมายเหตุ:</strong> Finance เป็นบทบาทสำหรับผู้ที่ดูแลการเติม/ถอนเงินให้ลูกค้าเท่านั้น ไม่มีสิทธิ์อนุมัติหรือตั้งค่าระบบ
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {activeRole === 'developer' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                          <Code className="w-7 h-7 text-indigo-500" />
                          Developer
                        </h2>
                        <p className="text-muted-foreground">
                          มีสิทธิ์เข้าถึงข้อมูลทางเทคนิคและ API แต่ไม่มีสิทธิ์ในการจัดการธุรกรรมหรือผู้ใช้
                        </p>
                      </div>

                      <PermissionAlert
                        canDo={[
                          'ดู Dashboard (แบบจำกัด)',
                          'ดู Payments (อ่านอย่างเดียว)',
                          'ดู Webhook Events',
                          'ดู API Documentation',
                          'ดู API Keys (ไม่สามารถสร้าง/ลบ)',
                          'ทดสอบ API Calls',
                          'ดู Error Logs',
                          'ดู Technical Reports',
                        ]}
                        cannotDo={[
                          'สร้าง/อนุมัติ Refunds',
                          'ดูข้อมูลลูกค้าที่ละเอียดอ่อน (PII)',
                          'จัดการผู้ใช้',
                          'สร้าง/ลบ API Keys',
                          'จัดการ Webhooks',
                          'ทำ System Deposit/Withdrawal',
                          'Export ข้อมูลลูกค้า',
                          'ดู Settlement Details',
                        ]}
                      />

                      <TestSection
                        title="การทดสอบ API Access"
                        items={[
                          'ดู API Documentation',
                          'ทดสอบ API Endpoints ผ่าน Dashboard',
                          'ดูตัวอย่าง API Requests/Responses',
                          'ดู API Rate Limits',
                          'ดู API Error Logs',
                        ]}
                      />

                      <TestSection
                        title="การทดสอบ Webhook Events"
                        items={[
                          'ดูรายการ Webhook Events',
                          'ดูรายละเอียด Event Payload',
                          'ดู Delivery Status',
                          'ดู Retry History',
                          'พยายามทดสอบ Webhook → ควรไม่สามารถทำได้',
                        ]}
                      />

                      <Alert className="border-indigo-500/50 bg-indigo-500/10">
                        <Info className="h-4 w-4 text-indigo-500" />
                        <AlertDescription>
                          <strong>หมายเหตุ:</strong> Developer สามารถเข้าถึง API Documentation และ Webhook Events 
                          แต่ไม่สามารถทำการเปลี่ยนแปลงใดๆ กับระบบได้
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default TestingGuide;