-- Add 'manager' role to all existing tenants
-- Insert manager role for each tenant that doesn't already have it
INSERT INTO public.roles (tenant_id, name, description, is_system)
SELECT 
  t.id as tenant_id,
  'manager' as name,
  'Manager with administrative access' as description,
  true as is_system
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r 
  WHERE r.tenant_id = t.id AND r.name = 'manager'
);

-- Grant permissions to manager role (similar to admin)
-- Manager gets all permissions except some sensitive settings
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id as role_id, p.id as permission_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'manager'
AND p.name NOT IN ('settings.manage', 'users.manage')
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = r.id AND rp.permission_id = p.id
);