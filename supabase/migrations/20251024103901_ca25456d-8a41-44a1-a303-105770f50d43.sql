-- ลบ permissions และ role_permissions เก่าทั้งหมด
DELETE FROM public.role_permissions;
DELETE FROM public.permissions;

-- เพิ่ม permissions ใหม่แบบกระชับ (16 permissions)

-- === PAYMENTS & TRANSACTIONS (3) ===
INSERT INTO public.permissions (name, description) VALUES
('payments.view', 'ดูรายการชำระเงินและธุรกรรม'),
('payments.manage', 'จัดการการชำระเงิน สร้าง และคืนเงิน'),
('disputes.manage', 'จัดการข้อพิพาทและการโต้แย้ง');

-- === CUSTOMERS (2) ===
INSERT INTO public.permissions (name, description) VALUES
('customers.view', 'ดูข้อมูลลูกค้า'),
('customers.manage', 'จัดการข้อมูลลูกค้าทั้งหมด');

-- === FINANCIAL REPORTS (2) ===
INSERT INTO public.permissions (name, description) VALUES
('settlements.view', 'ดูการตัดยอดและการโอนเงิน'),
('reports.view', 'ดูรายงานและสถิติทางการเงิน');

-- === DEVELOPER TOOLS (3) ===
INSERT INTO public.permissions (name, description) VALUES
('api_keys.manage', 'จัดการ API Keys และการเข้าถึง API'),
('webhooks.manage', 'จัดการ Webhooks และการแจ้งเตือน'),
('payment_links.manage', 'จัดการลิงก์การชำระเงิน');

-- === SYSTEM SETTINGS (3) ===
INSERT INTO public.permissions (name, description) VALUES
('settings.manage', 'จัดการการตั้งค่าระบบและช่องทางชำระเงิน'),
('kyc.manage', 'จัดการการยืนยันตัวตนและเอกสาร KYC'),
('products.manage', 'จัดการสินค้าและราคา');

-- === USERS & SECURITY (3) ===
INSERT INTO public.permissions (name, description) VALUES
('users.manage', 'จัดการผู้ใช้และสิทธิ์การเข้าถึง'),
('audit.view', 'ดู Audit Logs และประวัติการทำงาน'),
('approvals.manage', 'อนุมัติและจัดการคำขอต่างๆ');

-- กำหนดสิทธิสำหรับ Owner Role (ทุกอย่าง)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'owner' AND r.is_system = true;

-- กำหนดสิทธิสำหรับ Admin Role (ทุกอย่างยกเว้น users.manage)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin' AND r.is_system = true
AND p.name != 'users.manage';

-- กำหนดสิทธิสำหรับ Developer Role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'developer' AND r.is_system = true
AND p.name IN (
  'payments.view',
  'customers.view',
  'api_keys.manage',
  'webhooks.manage',
  'payment_links.manage',
  'audit.view'
);

-- กำหนดสิทธิสำหรับ Finance Role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'finance' AND r.is_system = true
AND p.name IN (
  'payments.view',
  'payments.manage',
  'disputes.manage',
  'customers.view',
  'settlements.view',
  'reports.view',
  'audit.view'
);

-- กำหนดสิทธิสำหรับ Viewer Role (ดูอย่างเดียว)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'viewer' AND r.is_system = true
AND p.name IN (
  'payments.view',
  'customers.view',
  'settlements.view',
  'reports.view',
  'audit.view'
);