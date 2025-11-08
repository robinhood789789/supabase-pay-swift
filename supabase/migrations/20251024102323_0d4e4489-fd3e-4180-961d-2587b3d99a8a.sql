-- Clear existing permissions and add comprehensive payment gateway permissions
TRUNCATE TABLE public.role_permissions CASCADE;
TRUNCATE TABLE public.permissions CASCADE;

-- Insert comprehensive permissions for payment gateway
INSERT INTO public.permissions (id, name, description) VALUES
-- Payments
(gen_random_uuid(), 'payments.view', 'ดูรายการชำระเงินทั้งหมด'),
(gen_random_uuid(), 'payments.create', 'สร้างรายการชำระเงินใหม่'),
(gen_random_uuid(), 'payments.refund', 'ดำเนินการคืนเงิน'),
(gen_random_uuid(), 'payments.export', 'ส่งออกข้อมูลการชำระเงิน'),
(gen_random_uuid(), 'payments.cancel', 'ยกเลิกการชำระเงิน'),

-- Customers
(gen_random_uuid(), 'customers.view', 'ดูข้อมูลลูกค้า'),
(gen_random_uuid(), 'customers.create', 'เพิ่มลูกค้าใหม่'),
(gen_random_uuid(), 'customers.edit', 'แก้ไขข้อมูลลูกค้า'),
(gen_random_uuid(), 'customers.delete', 'ลบข้อมูลลูกค้า'),

-- Settlements
(gen_random_uuid(), 'settlements.view', 'ดูข้อมูลการชำระบัญชี'),
(gen_random_uuid(), 'settlements.manage', 'จัดการการชำระบัญชี'),
(gen_random_uuid(), 'settlements.export', 'ส่งออกข้อมูลการชำระบัญชี'),

-- Refunds
(gen_random_uuid(), 'refunds.view', 'ดูรายการคืนเงิน'),
(gen_random_uuid(), 'refunds.create', 'สร้างคำขอคืนเงิน'),
(gen_random_uuid(), 'refunds.approve', 'อนุมัติการคืนเงิน'),

-- Disputes
(gen_random_uuid(), 'disputes.view', 'ดูข้อพิพาท'),
(gen_random_uuid(), 'disputes.manage', 'จัดการข้อพิพาท'),
(gen_random_uuid(), 'disputes.respond', 'ตอบกลับข้อพิพาท'),

-- API Keys
(gen_random_uuid(), 'api_keys.view', 'ดู API Keys'),
(gen_random_uuid(), 'api_keys.create', 'สร้าง API Keys ใหม่'),
(gen_random_uuid(), 'api_keys.revoke', 'เพิกถอน API Keys'),

-- Webhooks
(gen_random_uuid(), 'webhooks.view', 'ดูการตั้งค่า Webhooks'),
(gen_random_uuid(), 'webhooks.create', 'สร้าง Webhooks ใหม่'),
(gen_random_uuid(), 'webhooks.edit', 'แก้ไข Webhooks'),
(gen_random_uuid(), 'webhooks.delete', 'ลบ Webhooks'),
(gen_random_uuid(), 'webhooks.test', 'ทดสอบ Webhooks'),

-- Reports
(gen_random_uuid(), 'reports.view', 'ดูรายงานต่างๆ'),
(gen_random_uuid(), 'reports.export', 'ส่งออกรายงาน'),
(gen_random_uuid(), 'reports.financial', 'ดูรายงานทางการเงิน'),

-- Settings
(gen_random_uuid(), 'settings.view', 'ดูการตั้งค่าทั่วไป'),
(gen_random_uuid(), 'settings.payment_methods', 'จัดการวิธีการชำระเงิน'),
(gen_random_uuid(), 'settings.security', 'จัดการความปลอดภัย'),
(gen_random_uuid(), 'settings.branding', 'จัดการแบรนด์และรูปลักษณ์'),
(gen_random_uuid(), 'settings.notifications', 'จัดการการแจ้งเตือน'),

-- Users & Access
(gen_random_uuid(), 'users.view', 'ดูรายชื่อผู้ใช้'),
(gen_random_uuid(), 'users.create', 'เพิ่มผู้ใช้ใหม่'),
(gen_random_uuid(), 'users.edit', 'แก้ไขข้อมูลผู้ใช้'),
(gen_random_uuid(), 'users.delete', 'ลบผู้ใช้'),
(gen_random_uuid(), 'users.roles', 'จัดการบทบาทและสิทธิ์'),

-- KYC
(gen_random_uuid(), 'kyc.view', 'ดูเอกสารยืนยันตัวตน'),
(gen_random_uuid(), 'kyc.upload', 'อัพโหลดเอกสาร KYC'),
(gen_random_uuid(), 'kyc.verify', 'ตรวจสอบและอนุมัติ KYC'),
(gen_random_uuid(), 'kyc.reject', 'ปฏิเสธเอกสาร KYC'),

-- Products
(gen_random_uuid(), 'products.view', 'ดูรายการสินค้า'),
(gen_random_uuid(), 'products.create', 'เพิ่มสินค้าใหม่'),
(gen_random_uuid(), 'products.edit', 'แก้ไขข้อมูลสินค้า'),
(gen_random_uuid(), 'products.delete', 'ลบสินค้า'),

-- Payment Links
(gen_random_uuid(), 'payment_links.view', 'ดู Payment Links'),
(gen_random_uuid(), 'payment_links.create', 'สร้าง Payment Links'),
(gen_random_uuid(), 'payment_links.disable', 'ปิดการใช้งาน Payment Links'),

-- Approvals
(gen_random_uuid(), 'approvals.view', 'ดูคำขออนุมัติ'),
(gen_random_uuid(), 'approvals.decide', 'อนุมัติ/ปฏิเสธคำขอ'),

-- Audit & Logs
(gen_random_uuid(), 'audit_logs.view', 'ดูบันทึกการตรวจสอบ'),
(gen_random_uuid(), 'activity.view', 'ดูประวัติการใช้งาน'),

-- Alerts
(gen_random_uuid(), 'alerts.view', 'ดูการแจ้งเตือน'),
(gen_random_uuid(), 'alerts.manage', 'จัดการการแจ้งเตือน'),
(gen_random_uuid(), 'alerts.resolve', 'แก้ไขการแจ้งเตือน'),

-- Reconciliation
(gen_random_uuid(), 'reconciliation.view', 'ดูการกระทบยอด'),
(gen_random_uuid(), 'reconciliation.upload', 'อัพโหลดไฟล์กระทบยอด'),
(gen_random_uuid(), 'reconciliation.approve', 'อนุมัติการกระทบยอด'),

-- Dashboard & Analytics
(gen_random_uuid(), 'dashboard.view', 'ดู Dashboard'),
(gen_random_uuid(), 'analytics.view', 'ดูสถิติและการวิเคราะห์'),
(gen_random_uuid(), 'analytics.export', 'ส่งออกข้อมูลการวิเคราะห์');

-- Update role permissions based on role types
-- Owner gets all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'owner' AND r.is_system = true;

-- Admin gets most permissions except sensitive ones
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin' AND r.is_system = true
AND p.name NOT IN (
  'users.delete',
  'settings.security',
  'kyc.verify',
  'kyc.reject',
  'approvals.decide'
);

-- Developer gets technical permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'developer' AND r.is_system = true
AND p.name IN (
  'payments.view',
  'customers.view',
  'api_keys.view',
  'api_keys.create',
  'api_keys.revoke',
  'webhooks.view',
  'webhooks.create',
  'webhooks.edit',
  'webhooks.test',
  'settings.view',
  'dashboard.view',
  'activity.view',
  'products.view'
);

-- Finance gets payment-related permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'finance' AND r.is_system = true
AND p.name IN (
  'payments.view',
  'payments.export',
  'payments.refund',
  'customers.view',
  'settlements.view',
  'settlements.export',
  'refunds.view',
  'refunds.create',
  'reports.view',
  'reports.export',
  'reports.financial',
  'dashboard.view',
  'reconciliation.view',
  'reconciliation.upload',
  'analytics.view'
);

-- Viewer gets read-only permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'viewer' AND r.is_system = true
AND p.name LIKE '%.view';