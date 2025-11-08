-- Insert all necessary permissions
INSERT INTO public.permissions (name, description)
VALUES 
  ('deposits.view', 'View deposit transactions'),
  ('deposits.create', 'Create deposit transactions'),
  ('withdrawals.view', 'View withdrawal transactions'),
  ('withdrawals.create', 'Create withdrawal transactions'),
  ('payments.view', 'View payment transactions'),
  ('payments.create', 'Create payment transactions'),
  ('payments.refund', 'Refund payment transactions'),
  ('api_keys.view', 'View API keys'),
  ('api_keys.manage', 'Manage API keys')
ON CONFLICT (name) DO NOTHING;

-- Update role permissions for admin role (only deposits and withdrawals)
DO $$
DECLARE
  admin_role_record RECORD;
BEGIN
  FOR admin_role_record IN 
    SELECT id FROM public.roles WHERE name = 'admin'
  LOOP
    DELETE FROM public.role_permissions WHERE role_id = admin_role_record.id;
    
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT admin_role_record.id, p.id 
    FROM public.permissions p
    WHERE p.name IN ('deposits.view', 'deposits.create', 'withdrawals.view', 'withdrawals.create');
  END LOOP;
END $$;

-- Update role permissions for manager role (deposits, withdrawals, and payments)
DO $$
DECLARE
  manager_role_record RECORD;
BEGIN
  FOR manager_role_record IN 
    SELECT id FROM public.roles WHERE name = 'manager'
  LOOP
    DELETE FROM public.role_permissions WHERE role_id = manager_role_record.id;
    
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT manager_role_record.id, p.id 
    FROM public.permissions p
    WHERE p.name IN ('deposits.view', 'deposits.create', 'withdrawals.view', 'withdrawals.create', 'payments.view', 'payments.create', 'payments.refund');
  END LOOP;
END $$;

-- Update role permissions for developer role (only API management)
DO $$
DECLARE
  developer_role_record RECORD;
BEGIN
  FOR developer_role_record IN 
    SELECT id FROM public.roles WHERE name = 'developer'
  LOOP
    DELETE FROM public.role_permissions WHERE role_id = developer_role_record.id;
    
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT developer_role_record.id, p.id 
    FROM public.permissions p
    WHERE p.name IN ('api_keys.view', 'api_keys.manage');
  END LOOP;
END $$;

-- Update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_tenant_id uuid;
  owner_role_id uuid;
  admin_role_id uuid;
  developer_role_id uuid;
  finance_role_id uuid;
  viewer_role_id uuid;
  manager_role_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.tenants (name, status)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Workspace', 'active')
  RETURNING id INTO new_tenant_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'owner', 'Tenant owner with full access', true)
  RETURNING id INTO owner_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'admin', 'Administrator with deposits and withdrawals access', true)
  RETURNING id INTO admin_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'developer', 'Developer with API access', true)
  RETURNING id INTO developer_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'manager', 'Manager with deposits, withdrawals, and payments access', true)
  RETURNING id INTO manager_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'finance', 'Finance user with payment access', true)
  RETURNING id INTO finance_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'viewer', 'Read-only access', true)
  RETURNING id INTO viewer_role_id;
  
  -- Owner: all permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT owner_role_id, id FROM public.permissions;
  
  -- Admin: only deposits and withdrawals
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM public.permissions
  WHERE name IN ('deposits.view', 'deposits.create', 'withdrawals.view', 'withdrawals.create');
  
  -- Developer: only API management
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT developer_role_id, id FROM public.permissions
  WHERE name IN ('api_keys.view', 'api_keys.manage');
  
  -- Manager: deposits, withdrawals, and payments
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT manager_role_id, id FROM public.permissions
  WHERE name IN ('deposits.view', 'deposits.create', 'withdrawals.view', 'withdrawals.create', 'payments.view', 'payments.create', 'payments.refund');
  
  -- Finance: payment and settlement related
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT finance_role_id, id FROM public.permissions
  WHERE name IN ('payments.view', 'payments.create', 'payments.refund', 'customers.view', 'settlements.view', 'reports.view');
  
  -- Viewer: read-only access
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT viewer_role_id, id FROM public.permissions
  WHERE name LIKE '%.view';
  
  INSERT INTO public.memberships (user_id, tenant_id, role_id)
  VALUES (NEW.id, new_tenant_id, owner_role_id);
  
  RETURN NEW;
END;
$function$;