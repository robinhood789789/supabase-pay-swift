# คู่มือการทดสอบบัญชีผู้ใช้ตามบทบาท

## ภาพรวมโครงสร้างบัญชี

### ฝั่งระบบ (System Side)
- **Super Admin** - ผู้สร้างและควบคุมระบบทั้งหมด

### ฝั่งผู้ใช้งาน (User Side)
1. **Owner** - เจ้าขององค์กร
2. **Manager** - ผู้จัดการ
3. **Admin** - ผู้ดูแลระบบ
4. **Developer** - นักพัฒนา

---

## 1. การทดสอบบัญชี Super Admin

### วัตถุประสงค์
Super Admin เป็นบัญชีระดับสูงสุดที่มีสิทธิ์ควบคุมทุกอย่างในระบบ รวมถึงการจัดการ tenant ทั้งหมด

### ขั้นตอนการทดสอบ

#### 1.1 การเข้าสู่ระบบ
- [ ] เข้าสู่ระบบด้วย super admin credentials
- [ ] ตรวจสอบว่าระบบแสดง role เป็น "Super Admin"
- [ ] ยืนยันว่าไม่ต้องเลือก tenant เนื่องจาก super admin มีสิทธิ์เข้าถึงทุก tenant

#### 1.2 การเข้าถึงเมนู/หน้าต่างๆ
เช็คว่า Super Admin เข้าถึงได้ทุกหน้า:

**หน้าพิเศษสำหรับ Super Admin:**
- [ ] `/admin/super-admin-dashboard` - Dashboard สำหรับ Super Admin
- [ ] `/admin/tenant-management` - จัดการ Tenant ทั้งหมด
- [ ] `/admin/provision-merchant` - สร้าง Merchant ใหม่
- [ ] `/admin/platform-security` - ความปลอดภัยระดับ Platform
- [ ] `/admin/platform-audit` - ตรวจสอบ Audit ทั้งระบบ
- [ ] `/workbench` - Admin Workbench

**หน้าทั่วไป:**
- [ ] `/dashboard` - Dashboard
- [ ] `/payments` - การชำระเงิน
- [ ] `/refunds` - การคืนเงิน
- [ ] `/settlements` - การชำระบัญชี
- [ ] `/customers` - ลูกค้า
- [ ] `/reports` - รายงาน

#### 1.3 การจัดการ Tenant
- [ ] ดูรายการ Tenant ทั้งหมดในระบบ
- [ ] สร้าง Tenant ใหม่
- [ ] แก้ไขข้อมูล Tenant
- [ ] ปิดการใช้งาน/เปิดการใช้งาน Tenant
- [ ] ดู Audit Log ของทุก Tenant

#### 1.4 การจัดการผู้ใช้ข้ามองค์กร
- [ ] ดูรายการผู้ใช้ทั้งหมดในระบบ
- [ ] สร้าง Owner User สำหรับ Tenant ต่างๆ
- [ ] แก้ไขสิทธิ์ผู้ใช้ข้าม Tenant
- [ ] ลบผู้ใช้ออกจากระบบ (ถาวร)

#### 1.5 ความปลอดภัยและการตรวจสอบ
- [ ] ดู Security Audit ของทั้งระบบ
- [ ] ดู Activity Log ของทุก Tenant
- [ ] ตั้งค่า Security Policy ระดับ Platform
- [ ] จัดการ API Keys ระดับ Platform

#### 1.6 การดำเนินการพิเศษ
- [ ] Global Refund Freeze - หยุดการคืนเงินทั้งระบบ
- [ ] System Deposit/Withdrawal - ทำธุรกรรมระดับระบบ
- [ ] Access Cross-Tenant Audit - เข้าถึงข้อมูลข้ามองค์กร
- [ ] Bootstrap Admin - สร้าง admin แรกของระบบ

---

## 2. การทดสอบบัญชี Owner

### วัตถุประสงค์
Owner เป็นเจ้าขององค์กร มีสิทธิ์ควบคุมทุกอย่างภายใน Tenant ของตนเอง

### ขั้นตอนการทดสอบ

#### 2.1 การเข้าสู่ระบบ
- [ ] เข้าสู่ระบบด้วย owner credentials
- [ ] ตรวจสอบว่าระบบแสดง role เป็น "Owner"
- [ ] ยืนยันว่าเห็น Tenant ของตนเองเท่านั้น

#### 2.2 Dashboard และภาพรวม
- [ ] ดูสถิติการชำระเงินรวม
- [ ] ดูยอดขายประจำวัน/สัปดาห์/เดือน
- [ ] ดูรายการธุรกรรมล่าสุด
- [ ] ดู Payment Success Rate
- [ ] ดูจำนวนลูกค้าทั้งหมด

#### 2.3 การจัดการการชำระเงิน (Payments)
- [ ] ดูรายการ Payments ทั้งหมด
- [ ] ค้นหา/กรอง Payments
- [ ] ดูรายละเอียด Payment แต่ละรายการ
- [ ] Export ข้อมูล Payments (ต้องมี MFA)
- [ ] สร้าง Payment Links
- [ ] ปิดการใช้งาน Payment Links

#### 2.4 การจัดการการคืนเงิน (Refunds)
- [ ] ดูรายการ Refunds ทั้งหมด
- [ ] สร้าง Refund ใหม่
- [ ] อนุมัติ/ปฏิเสธ Refund
- [ ] ดู Refund History
- [ ] ตรวจสอบ Refund Rate

#### 2.5 การจัดการการชำระบัญชี (Settlements)
- [ ] ดูรายการ Settlements
- [ ] ดูรายละเอียด Settlement แต่ละรอบ
- [ ] ดู Settlement Summary
- [ ] Export Settlement Reports
- [ ] ตรวจสอบ MDR (Merchant Discount Rate)

#### 2.6 การจัดการลูกค้า (Customers)
- [ ] ดูรายการลูกค้าทั้งหมด
- [ ] ค้นหาลูกค้า
- [ ] ดูประวัติการซื้อของลูกค้า
- [ ] ดูข้อมูล KYC ของลูกค้า
- [ ] Export ข้อมูลลูกค้า

#### 2.7 การจัดการผู้ใช้ในองค์กร (Team Management)
- [ ] เชิญผู้ใช้ใหม่ (Manager/Admin/Developer)
- [ ] กำหนด Role และ Permissions
- [ ] แก้ไขสิทธิ์ผู้ใช้
- [ ] ลบผู้ใช้ออกจากองค์กร
- [ ] ดู Activity Log ของทีม

#### 2.8 การตั้งค่า (Settings)
**General Settings:**
- [ ] แก้ไขข้อมูลองค์กร
- [ ] อัพโหลดโลโก้
- [ ] ตั้งค่าข้อมูลติดต่อ

**Payment Methods:**
- [ ] เปิด/ปิดช่องทางการชำระเงิน
- [ ] ตั้งค่า Payment Gateway (OPN, Stripe, K-Bank, 2C2P)
- [ ] กำหนด Payment Method ตามประเทศ

**Security:**
- [ ] ตั้งค่า 2FA สำหรับตนเอง
- [ ] บังคับใช้ 2FA สำหรับทีม
- [ ] ตั้งค่า Security Policy ขององค์กร
- [ ] จัดการ Session Timeout

**API Keys:**
- [ ] สร้าง API Keys
- [ ] ดู API Keys ที่มีอยู่
- [ ] Revoke API Keys
- [ ] ตั้งค่า API Rate Limits

**Webhooks:**
- [ ] เพิ่ม Webhook Endpoints
- [ ] ทดสอบ Webhooks
- [ ] ดู Webhook Events
- [ ] จัดการ Webhook Retry

#### 2.9 รายงานและการวิเคราะห์ (Reports)
- [ ] ดูรายงานยอดขาย
- [ ] ดูรายงานการคืนเงิน
- [ ] ดูรายงาน Settlement
- [ ] ดูรายงาน Transaction Trends
- [ ] Export รายงานทั้งหมด

#### 2.10 KYC และการตรวจสอบ
- [ ] ดูสถานะ KYC ขององค์กร
- [ ] อัพโหลดเอกสาร KYC
- [ ] ติดตามสถานะการตรวจสอบ
- [ ] ดูประวัติ KYC

#### 2.11 Reconciliation (การกระทบยอด)
- [ ] อัพโหลดไฟล์ Bank Statement
- [ ] ดูผลการกระทบยอด
- [ ] ดูรายการที่ไม่ตรงกัน
- [ ] Export Reconciliation Report

#### 2.12 การดำเนินการพิเศษของ Owner
- [ ] **System Deposit** - เติมเงินเข้าระบบ
- [ ] **System Withdrawal** - ถอนเงินออกจากระบบ
- [ ] อนุมัติธุรกรรมขนาดใหญ่
- [ ] ตั้งค่า Guardrails (ข้อจำกัดความปลอดภัย)
- [ ] ดู Activity History ทั้งหมดในองค์กร

#### 2.13 Approvals (การอนุมัติ)
- [ ] ดูคำขออนุมัติที่รอดำเนินการ
- [ ] อนุมัติ Deposit Requests
- [ ] อนุมัติ Withdrawal Requests
- [ ] อนุมัติ Large Exports (>10,000 records)
- [ ] ปฏิเสธคำขอพร้อมเหตุผล

#### 2.14 Alerts Management
- [ ] ดู Alerts ที่เกิดขึ้น
- [ ] รับแจ้งเตือนเมื่อมี Refund Rate สูง
- [ ] รับแจ้งเตือนการ Export นอกเวลา
- [ ] รับแจ้งเตือนธุรกรรมผิดปกติ
- [ ] Acknowledge/Close Alerts

---

## 3. การทดสอบบัญชี Manager

### วัตถุประสงค์
Manager มีสิทธิ์จัดการงานประจำวันและอนุมัติธุรกรรมปกติ แต่ไม่มีสิทธิ์ในการตั้งค่าระบบหรือจัดการผู้ใช้

### ขั้นตอนการทดสอบ

#### 3.1 การเข้าสู่ระบบ
- [ ] เข้าสู่ระบบด้วย manager credentials
- [ ] ตรวจสอบว่าระบบแสดง role เป็น "Manager"
- [ ] ยืนยันว่าเห็น Tenant ที่ได้รับมอบหมายเท่านั้น

#### 3.2 สิทธิ์ที่ Manager มี
- [ ] ดู Dashboard และสถิติ
- [ ] ดูและจัดการ Payments
- [ ] สร้างและอนุมัติ Refunds
- [ ] ดู Settlements
- [ ] ดูและจัดการ Customers
- [ ] สร้าง Payment Links
- [ ] ดู Reports
- [ ] ดู Activity History

#### 3.3 สิทธิ์ที่ Manager ไม่มี (ต้องไม่เห็นหรือเข้าถึงได้)
- [ ] ไม่เห็นเมนู "Settings" หรือเห็นแต่ไม่สามารถแก้ไขได้
- [ ] ไม่สามารถจัดการผู้ใช้ (เชิญ/ลบ)
- [ ] ไม่สามารถสร้าง/ลบ API Keys
- [ ] ไม่สามารถจัดการ Webhooks
- [ ] ไม่สามารถตั้งค่า Payment Gateways
- [ ] ไม่สามารถทำ System Deposit/Withdrawal
- [ ] ไม่สามารถแก้ไข Security Policies
- [ ] ไม่สามารถ Export ข้อมูลขนาดใหญ่ (>1,000 records)

#### 3.4 การทดสอบ Permission Gates
- [ ] พยายามเข้าถึง URL `/settings` โดยตรง → ควรถูกปฏิเสธ
- [ ] พยายามเข้าถึง URL `/admin/users` โดยตรง → ควรถูกปฏิเสธ
- [ ] พยายามเรียก API สร้าง API Key → ควรได้ 403 Forbidden

#### 3.5 การทดสอบ Approvals
- [ ] สร้าง Refund Request
- [ ] อนุมัติ Refund ที่มีมูลค่าปกติ (<10,000 บาท)
- [ ] พยายามอนุมัติ Refund ที่มีมูลค่าสูง (>50,000 บาท) → ควรต้องรอ Owner

---

## 4. การทดสอบบัญชี Admin

### วัตถุประสงค์
Admin มีสิทธิ์ในการตั้งค่าระบบและจัดการผู้ใช้ แต่ไม่มีสิทธิ์ทางการเงินระดับสูง

### ขั้นตอนการทดสอบ

#### 4.1 การเข้าสู่ระบบ
- [ ] เข้าสู่ระบบด้วย admin credentials
- [ ] ตรวจสอบว่าระบบแสดง role เป็น "Admin"
- [ ] ยืนยันว่าเห็น Tenant ที่ได้รับมอบหมายเท่านั้น

#### 4.2 สิทธิ์ที่ Admin มี
- [ ] ดู Dashboard และสถิติ
- [ ] ดู Payments (อ่านอย่างเดียว)
- [ ] ดู Refunds (อ่านอย่างเดียว)
- [ ] ดู Settlements (อ่านอย่างเดียว)
- [ ] ดูและจัดการ Customers
- [ ] จัดการผู้ใช้ในองค์กร (เชิญ/ลบ Manager และ Developer)
- [ ] จัดการ Webhooks
- [ ] ดู API Keys (แต่ไม่สามารถสร้างใหม่)
- [ ] ตั้งค่า Payment Methods
- [ ] ดู Reports

#### 4.3 สิทธิ์ที่ Admin ไม่มี (ต้องไม่เห็นหรือเข้าถึงได้)
- [ ] ไม่สามารถสร้าง/อนุมัติ Refunds
- [ ] ไม่สามารถทำ System Deposit/Withdrawal
- [ ] ไม่สามารถสร้าง API Keys
- [ ] ไม่สามารถเชิญ Owner หรือ Admin อื่น
- [ ] ไม่สามารถลบ Owner
- [ ] ไม่สามารถแก้ไข Security Policies ระดับสูง

#### 4.4 การทดสอบการจัดการผู้ใช้
- [ ] เชิญ Manager ใหม่
- [ ] เชิญ Developer ใหม่
- [ ] แก้ไข Permissions ของ Manager
- [ ] แก้ไข Permissions ของ Developer
- [ ] ลบ Manager ออกจากองค์กร
- [ ] ลบ Developer ออกจากองค์กร
- [ ] พยายามเชิญ Admin ใหม่ → ควรไม่สามารถทำได้
- [ ] พยายามลบ Owner → ควรไม่สามารถทำได้

#### 4.5 การทดสอบ Webhooks Management
- [ ] เพิ่ม Webhook Endpoint ใหม่
- [ ] แก้ไข Webhook Endpoint
- [ ] ทดสอบ Webhook
- [ ] ดู Webhook Events
- [ ] ลบ Webhook Endpoint

#### 4.6 การทดสอบ Payment Methods
- [ ] ดูช่องทางการชำระเงินที่มีอยู่
- [ ] เปิด/ปิดช่องทางการชำระเงิน (ต้องมีการอนุมัติจาก Owner)
- [ ] ดูการตั้งค่า Gateway

---

## 5. การทดสอบบัญชี Developer

### วัตถุประสงค์
Developer มีสิทธิ์เข้าถึงข้อมูลทางเทคนิคและ API แต่ไม่มีสิทธิ์ในการจัดการธุรกรรมหรือผู้ใช้

### ขั้นตอนการทดสอบ

#### 5.1 การเข้าสู่ระบบ
- [ ] เข้าสู่ระบบด้วย developer credentials
- [ ] ตรวจสอบว่าระบบแสดง role เป็น "Developer"
- [ ] ยืนยันว่าเห็น Tenant ที่ได้รับมอบหมายเท่านั้น

#### 5.2 สิทธิ์ที่ Developer มี
- [ ] ดู Dashboard (แบบจำกัด)
- [ ] ดู Payments (อ่านอย่างเดียว)
- [ ] ดู Webhook Events
- [ ] ดู API Documentation
- [ ] ดู API Keys (แต่ไม่สามารถสร้าง/ลบ)
- [ ] ทดสอบ API Calls
- [ ] ดู Error Logs
- [ ] ดู Technical Reports

#### 5.3 สิทธิ์ที่ Developer ไม่มี (ต้องไม่เห็นหรือเข้าถึงได้)
- [ ] ไม่สามารถสร้าง/อนุมัติ Refunds
- [ ] ไม่สามารถดูข้อมูลลูกค้าที่ละเอียดอ่อน (PII)
- [ ] ไม่สามารถจัดการผู้ใช้
- [ ] ไม่สามารถสร้าง/ลบ API Keys
- [ ] ไม่สามารถจัดการ Webhooks
- [ ] ไม่สามารถทำ System Deposit/Withdrawal
- [ ] ไม่สามารถ Export ข้อมูลลูกค้า
- [ ] ไม่สามารถดู Settlement Details

#### 5.4 การทดสอบ API Access
- [ ] ดู API Documentation
- [ ] ทดสอบ API Endpoints ผ่าน Dashboard
- [ ] ดูตัวอย่าง API Requests/Responses
- [ ] ดู API Rate Limits
- [ ] ดู API Error Logs

#### 5.5 การทดสอบ Webhook Events
- [ ] ดูรายการ Webhook Events
- [ ] ดูรายละเอียด Event Payload
- [ ] ดู Delivery Status
- [ ] ดู Retry History
- [ ] พยายามทดสอบ Webhook → ควรไม่สามารถทำได้ (ต้องมีสิทธิ์ Admin ขึ้นไป)

---

## 6. สถานการณ์ทดสอบข้ามบทบาท (Cross-Role Testing)

### 6.1 การทดสอบ Permission Escalation
- [ ] ลอง login ด้วย Developer แล้วพยายามเปลี่ยน role เป็น Owner ผ่าน Browser DevTools
- [ ] ลอง login ด้วย Manager แล้วพยายามเข้าถึง Admin API โดยตรง
- [ ] ตรวจสอบว่า API มีการตรวจสอบสิทธิ์ที่ server-side อย่างเคร่งครัด

### 6.2 การทดสอบ Tenant Isolation
- [ ] Login ด้วย Owner ของ Tenant A
- [ ] พยายามเข้าถึงข้อมูลของ Tenant B โดยการแก้ไข URL parameter
- [ ] ยืนยันว่าระบบปฏิเสธการเข้าถึง

### 6.3 การทดสอบ Multi-Factor Authentication (MFA)
- [ ] เปิดใช้งาน 2FA สำหรับแต่ละบัญชี
- [ ] ทดสอบ login ด้วย 2FA
- [ ] ทดสอบ Step-Up Authentication สำหรับการทำธุรกรรมที่ sensitive
- [ ] ทดสอบ Recovery Codes

### 6.4 การทดสอบ Approval Workflow
**Scenario: Refund ที่ต้องการการอนุมัติ**
- [ ] Developer สร้าง Refund Request → ไม่สามารถทำได้
- [ ] Manager สร้าง Refund Request มูลค่า 5,000 บาท → สามารถอนุมัติเองได้
- [ ] Manager สร้าง Refund Request มูลค่า 100,000 บาท → ต้องรอ Owner อนุมัติ
- [ ] Owner อนุมัติ Refund → สำเร็จ

**Scenario: Export ข้อมูลขนาดใหญ่**
- [ ] Admin พยายาม Export ข้อมูล >10,000 records → ต้องใช้ MFA
- [ ] Manager พยายาม Export ข้อมูล >10,000 records → ต้องได้รับอนุมัติจาก Owner
- [ ] Developer พยายาม Export ข้อมูลลูกค้า → ไม่สามารถทำได้

---

## 7. การทดสอบฟังก์ชันพิเศษ

### 7.1 System Deposit (Owner Only)
- [ ] Login ด้วย Owner
- [ ] ไปที่ System Deposit
- [ ] กรอกจำนวนเงิน
- [ ] ยืนยันธุรกรรม
- [ ] ตรวจสอบ Balance อัพเดท
- [ ] ตรวจสอบ Audit Log

### 7.2 System Withdrawal (Owner Only)
- [ ] Login ด้วย Owner
- [ ] ไปที่ System Withdrawal
- [ ] กรอกจำนวนเงิน
- [ ] ยืนยันธุรกรรม (ต้องใช้ MFA)
- [ ] ตรวจสอบ Balance อัพเดท
- [ ] ตรวจสอบ Audit Log

### 7.3 Global Refund Freeze (Super Admin Only)
- [ ] Login ด้วย Super Admin
- [ ] เปิดใช้งาน Global Refund Freeze
- [ ] Login ด้วย Owner ของ Tenant ใดก็ได้
- [ ] พยายามสร้าง Refund → ควรถูกบล็อก
- [ ] Login กลับด้วย Super Admin
- [ ] ปิด Global Refund Freeze
- [ ] ตรวจสอบว่า Refund กลับมาใช้งานได้ปกติ

### 7.4 Reconciliation Upload
- [ ] Login ด้วย Owner หรือ Manager
- [ ] อัพโหลด Bank Statement (CSV/Excel)
- [ ] ดูผลการกระทบยอด
- [ ] ตรวจสอบรายการที่ Match
- [ ] ตรวจสอบรายการที่ไม่ Match
- [ ] Export Reconciliation Report

---

## 8. การทดสอบ Security และ Compliance

### 8.1 Rate Limiting
- [ ] ทดสอบ API Rate Limits (ทำ requests มากเกินกำหนดภายในเวลาสั้น)
- [ ] ยืนยันว่าระบบบล็อก requests เกิน
- [ ] ตรวจสอบ Error Message ที่เหมาะสม

### 8.2 Session Management
- [ ] Login แล้ว idle นานเกิน timeout → session หมดอายุ
- [ ] Login บนหลาย device พร้อมกัน → ตรวจสอบพฤติกรรม
- [ ] Logout แล้วพยายามใช้ old session token → ควรถูกปฏิเสธ

### 8.3 Audit Logging
- [ ] ทำธุรกรรมต่างๆ (Refund, Export, User Management)
- [ ] ตรวจสอบว่าทุกการกระทำถูกบันทึกใน Audit Log
- [ ] ยืนยันว่า Log มีข้อมูลครบ (user, timestamp, action, IP address)

### 8.4 Data Privacy
- [ ] ตรวจสอบว่าข้อมูล PII ถูก mask ในหน้าจอที่ไม่จำเป็น
- [ ] ตรวจสอบว่า API responses ไม่ส่ง sensitive data เกินความจำเป็น
- [ ] ตรวจสอบว่า Logs ไม่เก็บ passwords หรือ payment details

---

## 9. Checklist การทดสอบรวม

### ✅ Super Admin
- [ ] Login/Logout
- [ ] Tenant Management
- [ ] Cross-Tenant Access
- [ ] Platform Security
- [ ] Global Operations
- [ ] All System Pages Accessible

### ✅ Owner
- [ ] Login/Logout
- [ ] Dashboard
- [ ] Payments Management
- [ ] Refunds Management
- [ ] Settlements
- [ ] Customer Management
- [ ] Team Management
- [ ] Settings (All)
- [ ] API Keys Management
- [ ] Webhooks Management
- [ ] Reports
- [ ] Reconciliation
- [ ] System Deposit/Withdrawal
- [ ] Approvals
- [ ] KYC
- [ ] Alerts Management

### ✅ Manager
- [ ] Login/Logout
- [ ] Dashboard (View)
- [ ] Payments Management
- [ ] Refunds Management
- [ ] Settlements (View)
- [ ] Customer Management
- [ ] Payment Links
- [ ] Reports (View)
- [ ] Cannot Access Settings
- [ ] Cannot Manage Users
- [ ] Cannot Create API Keys

### ✅ Admin
- [ ] Login/Logout
- [ ] Dashboard (View)
- [ ] Payments (View Only)
- [ ] Refunds (View Only)
- [ ] Customer Management
- [ ] User Management (Manager, Developer only)
- [ ] Webhooks Management
- [ ] Payment Methods Configuration
- [ ] Cannot Create Refunds
- [ ] Cannot System Deposit/Withdrawal

### ✅ Developer
- [ ] Login/Logout
- [ ] Dashboard (Limited View)
- [ ] Payments (View Only)
- [ ] API Documentation
- [ ] Webhook Events
- [ ] Technical Logs
- [ ] Cannot Access Customer PII
- [ ] Cannot Manage Users
- [ ] Cannot Create/Delete API Keys

---

## 10. เครื่องมือช่วยในการทดสอบ

### 10.1 การใช้ Browser DevTools
- เปิด Console เพื่อดู Client-side Errors
- เปิด Network Tab เพื่อดู API Calls และ Responses
- ตรวจสอบ localStorage/sessionStorage สำหรับ auth tokens

### 10.2 การใช้ Database Query
```sql
-- ตรวจสอบ User Roles
SELECT u.email, r.name as role, t.name as tenant
FROM auth.users u
JOIN memberships m ON u.id = m.user_id
JOIN roles r ON m.role_id = r.id
JOIN tenants t ON m.tenant_id = t.id;

-- ตรวจสอบ Permissions
SELECT u.email, p.name as permission
FROM auth.users u
JOIN memberships m ON u.id = m.user_id
JOIN role_permissions rp ON m.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE u.email = 'test@example.com';

-- ตรวจสอบ Audit Logs
SELECT * FROM audit_logs
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 50;
```

### 10.3 การใช้ API Testing Tools
- Postman หรือ Insomnia สำหรับทดสอบ API Endpoints
- ทดสอบด้วย tokens ของแต่ละ role
- ทดสอบ Authorization headers

---

## 11. Best Practices สำหรับการทดสอบ

1. **ทดสอบตามลำดับ**: เริ่มจาก Super Admin → Owner → Manager → Admin → Developer
2. **ใช้ข้อมูลจริง**: สร้างข้อมูลทดสอบที่ใกล้เคียงกับการใช้งานจริง
3. **ทดสอบ Edge Cases**: ลองกรณีที่มูลค่าเงินสูง, จำนวนข้อมูลมาก
4. **ทดสอบ Negative Scenarios**: พยายามทำสิ่งที่ไม่ควรทำได้
5. **บันทึกผล**: จดบันทึกทุก test case พร้อมผลลัพธ์
6. **ทดสอบซ้ำ**: หลังจากแก้ไข bug ต้องทดสอบซ้ำทั้งหมด
7. **ทดสอบบนหลาย Browser**: Chrome, Firefox, Safari, Edge
8. **ทดสอบบน Mobile**: Responsive design และ touch interactions

---

## 12. รายงานผลการทดสอบ

### Template สำหรับบันทึกผล

```
วันที่ทดสอบ: [DATE]
ผู้ทดสอบ: [NAME]
บทบาทที่ทดสอบ: [ROLE]
Browser/Device: [INFO]

ผลการทดสอบ:
✅ ผ่าน: [จำนวน] test cases
❌ ไม่ผ่าน: [จำนวน] test cases
⚠️ พบปัญหา: [รายละเอียด]

ปัญหาที่พบ:
1. [อธิบายปัญหา]
   - Severity: [High/Medium/Low]
   - Steps to reproduce: [...]
   - Expected: [...]
   - Actual: [...]

2. [อธิบายปัญหา]
   ...

ข้อเสนอแนะ:
[...]
```

---

## สรุป

เอกสารนี้ครอบคลุมการทดสอบที่ครบถ้วนสำหรับทุกบทบาทในระบบ Payment Gateway ตามโครงสร้าง Pyramid Authority Model เพื่อให้มั่นใจว่า:

1. ✅ ทุก role มีสิทธิ์ตามที่ออกแบบไว้
2. ✅ ไม่มี permission escalation vulnerabilities
3. ✅ Tenant isolation ทำงานถูกต้อง
4. ✅ Security features ทำงานครบถ้วน
5. ✅ User experience เหมาะสมกับแต่ละบทบาท

**หมายเหตุ**: การทดสอบควรทำอย่างละเอียดและสม่ำเสมอ โดยเฉพาะหลังจากการอัพเดทระบบหรือเพิ่มฟีเจอร์ใหม่