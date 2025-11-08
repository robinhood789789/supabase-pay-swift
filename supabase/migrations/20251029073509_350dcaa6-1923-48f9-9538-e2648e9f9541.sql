
-- Create 'finance' role for all tenants that don't have one
INSERT INTO public.roles (tenant_id, name, description)
SELECT DISTINCT t.id, 'finance', 'Finance Administrator - manages customer deposits and withdrawals'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r 
  WHERE r.tenant_id = t.id AND r.name = 'finance'
);

-- Get the finance role IDs and assign permissions
DO $$
DECLARE
  role_record RECORD;
  perm_id uuid;
BEGIN
  -- For each newly created finance role
  FOR role_record IN 
    SELECT r.id as role_id, r.tenant_id
    FROM public.roles r
    WHERE r.name = 'finance'
  LOOP
    -- Assign all necessary permissions
    -- Dashboard
    SELECT id INTO perm_id FROM public.permissions WHERE name = 'dashboard.view' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Deposits
    SELECT id INTO perm_id FROM public.permissions WHERE name = 'deposits.view' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    SELECT id INTO perm_id FROM public.permissions WHERE name = 'deposits.create' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Withdrawals
    SELECT id INTO perm_id FROM public.permissions WHERE name = 'withdrawals.view' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    SELECT id INTO perm_id FROM public.permissions WHERE name = 'withdrawals.create' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Payments
    SELECT id INTO perm_id FROM public.permissions WHERE name = 'payments.view' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    SELECT id INTO perm_id FROM public.permissions WHERE name = 'payments.create' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Customers
    SELECT id INTO perm_id FROM public.permissions WHERE name = 'customers.view' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Settlements
    SELECT id INTO perm_id FROM public.permissions WHERE name = 'settlements.view' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Reports
    SELECT id INTO perm_id FROM public.permissions WHERE name = 'reports.view' LIMIT 1;
    IF perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) 
      VALUES (role_record.role_id, perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Update all memberships with NULL role_id to use finance role
UPDATE public.memberships m
SET role_id = r.id
FROM public.roles r
WHERE m.role_id IS NULL
  AND r.tenant_id = m.tenant_id
  AND r.name = 'finance';
