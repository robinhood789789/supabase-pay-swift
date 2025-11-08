-- Update Finance role permissions to include Admin role permissions
-- Finance role will now handle: deposits, withdrawals, payments, customers, settlements, and reports

-- Get Finance and Admin role IDs for reference
DO $$
DECLARE
  finance_role_id UUID;
  admin_role_id UUID;
BEGIN
  -- Find Finance role (will vary by tenant, but we'll update the role_permissions template)
  -- Since roles are tenant-specific, we'll ensure Finance has all necessary permissions
  
  -- Add permissions to Finance role that Admin had
  -- Finance should have: deposits, withdrawals, payments (view/create), customers, settlements, reports
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT DISTINCT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
  WHERE r.name = 'finance'
    AND p.name IN (
      'deposits.view',
      'deposits.create',
      'withdrawals.view',
      'withdrawals.create',
      'payments.view',
      'payments.create',
      'customers.view',
      'settlements.view',
      'reports.view'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
    );
    
  -- Remove Admin role from all tenants
  -- First, update memberships with admin role to finance role
  UPDATE public.memberships m
  SET role_id = (
    SELECT r2.id 
    FROM public.roles r2 
    WHERE r2.tenant_id = m.tenant_id 
      AND r2.name = 'finance'
    LIMIT 1
  )
  WHERE role_id IN (
    SELECT id FROM public.roles WHERE name = 'admin'
  );
  
  -- Then delete role_permissions for admin roles
  DELETE FROM public.role_permissions
  WHERE role_id IN (
    SELECT id FROM public.roles WHERE name = 'admin'
  );
  
  -- Finally, delete admin roles
  DELETE FROM public.roles WHERE name = 'admin';
  
END $$;