-- Add payment_links:manage permission if it doesn't exist
INSERT INTO public.permissions (name, description) 
VALUES ('payment_links:manage', 'Can disable and manage payment links')
ON CONFLICT (name) DO NOTHING;

-- Grant payment_links:manage permission to owner role in all tenants
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'owner' 
  AND p.name = 'payment_links:manage'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );