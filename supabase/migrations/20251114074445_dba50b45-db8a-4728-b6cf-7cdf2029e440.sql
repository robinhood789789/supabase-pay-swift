-- Ensure deposits and withdrawals permissions exist
INSERT INTO public.permissions (name, category, description)
VALUES 
  ('deposits.view', 'finance', 'View deposit transactions')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.permissions (name, category, description)
VALUES 
  ('withdrawals.view', 'finance', 'View withdrawal transactions')
ON CONFLICT (name) DO NOTHING;

-- Grant deposits.view and withdrawals.view to owner role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'owner'
  AND p.name IN ('deposits.view', 'withdrawals.view')
ON CONFLICT DO NOTHING;

-- Also grant to manager and finance roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('manager', 'finance')
  AND p.name IN ('deposits.view', 'withdrawals.view')
ON CONFLICT DO NOTHING;