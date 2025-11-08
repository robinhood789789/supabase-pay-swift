
-- Add missing permissions for Finance and Manager roles

-- Finance role: Add dashboard.view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'finance'
  AND p.name = 'dashboard.view'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp2
    WHERE rp2.role_id = r.id AND rp2.permission_id = p.id
  );

-- Manager role: Add missing permissions
DO $$
DECLARE
  manager_perms text[] := ARRAY[
    'dashboard.view',
    'approvals.view',
    'approvals.approve',
    'customers.view',
    'settlements.view',
    'reports.view'
  ];
  perm text;
BEGIN
  FOREACH perm IN ARRAY manager_perms
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM public.roles r
    CROSS JOIN public.permissions p
    WHERE r.name = 'manager'
      AND p.name = perm
      AND NOT EXISTS (
        SELECT 1 FROM public.role_permissions rp2
        WHERE rp2.role_id = r.id AND rp2.permission_id = p.id
      );
  END LOOP;
END $$;

-- Create missing permissions if they don't exist
INSERT INTO public.permissions (name, description)
VALUES 
  ('dashboard.view', 'View dashboard and statistics'),
  ('approvals.view', 'View approval requests'),
  ('approvals.approve', 'Approve pending requests')
ON CONFLICT (name) DO NOTHING;

-- Add the newly created permissions to roles if needed
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'manager'
  AND p.name IN ('dashboard.view', 'approvals.view', 'approvals.approve')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp2
    WHERE rp2.role_id = r.id AND rp2.permission_id = p.id
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'finance'
  AND p.name = 'dashboard.view'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp2
    WHERE rp2.role_id = r.id AND rp2.permission_id = p.id
  );
