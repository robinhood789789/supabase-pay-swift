-- Add customers:read permission
INSERT INTO public.permissions (name, description)
VALUES ('customers:read', 'View customer information')
ON CONFLICT (name) DO NOTHING;

-- Grant customers:read permission to owner role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'owner' 
  AND r.is_system = true
  AND p.name = 'customers:read'
ON CONFLICT DO NOTHING;