-- Delete old permissions and their mappings
DELETE FROM public.role_permissions;
DELETE FROM public.permissions;

-- Insert new permissions based on Thai requirements
INSERT INTO public.permissions (name, description) VALUES
('dashboard', 'เข้าถึงแดชบอร์ด/ร้านค้า'),
('accounts', 'เข้าถึงบัญชี'),
('manage_slips', 'จัดการสลิป'),
('api_connect', 'API connect'),
('slip_verification_settings', 'การตั้งค่าตรวจสลิป'),
('qr_payment', 'QR รับเงิน'),
('branches', 'สาขา'),
('connect', 'เชื่อมต่อ'),
('camera_scan', 'Camera Scan'),
('usage_history', 'ประวัติการใช้งาน'),
('settings', 'การตั้งค่า');

-- Reassign all permissions to owner roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'owner';

-- Reassign most permissions to admin roles (except some sensitive ones)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin' 
AND p.name NOT IN ('settings', 'api_connect');

-- Reassign limited permissions to developer roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'developer' 
AND p.name IN ('dashboard', 'api_connect', 'usage_history');

-- Reassign limited permissions to finance roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'finance' 
AND p.name IN ('dashboard', 'accounts', 'manage_slips', 'usage_history');

-- Reassign view-only permissions to viewer roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'viewer' 
AND p.name IN ('dashboard', 'usage_history');