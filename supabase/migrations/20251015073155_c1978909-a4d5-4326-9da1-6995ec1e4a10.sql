-- Insert comprehensive permissions for payment gateway system
INSERT INTO public.permissions (name, description) VALUES
  ('payments:read', 'View payments'),
  ('payments:create', 'Create payments'),
  ('payments:update', 'Update payments'),
  ('payments:delete', 'Delete payments'),
  ('payments:refund', 'Refund payments'),
  ('refunds:read', 'View refunds'),
  ('refunds:create', 'Create refunds'),
  ('customers:read', 'View customers'),
  ('customers:create', 'Create customers'),
  ('customers:update', 'Update customers'),
  ('customers:delete', 'Delete customers'),
  ('settlements:read', 'View settlements'),
  ('reports:view', 'View reports'),
  ('api_keys:view', 'View API keys'),
  ('api_keys:manage', 'Manage API keys'),
  ('webhooks:view', 'View webhooks'),
  ('webhooks:manage', 'Manage webhooks'),
  ('settings:view', 'View settings'),
  ('settings:manage', 'Manage settings'),
  ('users:manage', 'Manage users'),
  ('roles:manage', 'Manage roles')
ON CONFLICT (name) DO NOTHING;

-- Grant all permissions to owner role for all tenants
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Grant payment-related permissions to admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
  AND p.name IN (
    'payments:read', 'payments:create', 'payments:refund',
    'refunds:read', 'refunds:create',
    'customers:read', 'customers:create', 'customers:update',
    'settlements:read', 'reports:view',
    'webhooks:view', 'settings:view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Grant finance permissions to finance role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'finance'
  AND p.name IN (
    'payments:read', 'payments:create', 'payments:refund',
    'refunds:read', 'refunds:create',
    'customers:read',
    'settlements:read', 'reports:view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Grant developer permissions to developer role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'developer'
  AND p.name IN (
    'payments:read', 'customers:read',
    'api_keys:view', 'api_keys:manage',
    'webhooks:view', 'webhooks:manage',
    'settings:view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Grant read-only permissions to viewer role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'viewer'
  AND p.name LIKE '%:read'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );