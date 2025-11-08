
-- Update all viewer memberships to finance role
UPDATE public.memberships m
SET role_id = r_finance.id
FROM public.roles r_viewer
JOIN public.roles r_finance ON r_finance.tenant_id = r_viewer.tenant_id AND r_finance.name = 'finance'
WHERE m.role_id = r_viewer.id
  AND r_viewer.name = 'viewer';

-- Delete role_permissions for viewer roles
DELETE FROM public.role_permissions rp
USING public.roles r
WHERE rp.role_id = r.id
  AND r.name = 'viewer';

-- Delete all viewer roles
DELETE FROM public.roles
WHERE name = 'viewer';

-- Update handle_new_user function to remove viewer role creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_tenant_id uuid;
  owner_role_id uuid;
  developer_role_id uuid;
  finance_role_id uuid;
  manager_role_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.tenants (name, status)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Workspace', 'active')
  RETURNING id INTO new_tenant_id;
  
  -- Create Owner role
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'owner', 'Tenant owner with full access', true)
  RETURNING id INTO owner_role_id;
  
  -- Create Developer role
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'developer', 'Developer with API access', true)
  RETURNING id INTO developer_role_id;
  
  -- Create Manager role
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'manager', 'Manager with deposits, withdrawals, and payments access', true)
  RETURNING id INTO manager_role_id;
  
  -- Create Finance role
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'finance', 'Finance user with deposits, withdrawals, and payment access', true)
  RETURNING id INTO finance_role_id;
  
  -- Owner: all permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT owner_role_id, id FROM public.permissions;
  
  -- Developer: only API management
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT developer_role_id, id FROM public.permissions
  WHERE name IN ('api_keys.view', 'api_keys.manage', 'webhooks.view', 'webhooks.manage');
  
  -- Manager: deposits, withdrawals, payments, and approvals
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT manager_role_id, id FROM public.permissions
  WHERE name IN (
    'dashboard.view',
    'deposits.view', 'deposits.create', 
    'withdrawals.view', 'withdrawals.create', 
    'payments.view', 'payments.create', 'payments.refund',
    'approvals.view', 'approvals.approve',
    'customers.view',
    'settlements.view',
    'reports.view'
  );
  
  -- Finance: deposits, withdrawals, payments, and financial operations
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT finance_role_id, id FROM public.permissions
  WHERE name IN (
    'dashboard.view',
    'deposits.view', 'deposits.create',
    'withdrawals.view', 'withdrawals.create',
    'payments.view', 'payments.create',
    'customers.view',
    'settlements.view',
    'reports.view'
  );
  
  -- Assign owner role to new user
  INSERT INTO public.memberships (user_id, tenant_id, role_id)
  VALUES (NEW.id, new_tenant_id, owner_role_id);
  
  RETURN NEW;
END;
$function$;
