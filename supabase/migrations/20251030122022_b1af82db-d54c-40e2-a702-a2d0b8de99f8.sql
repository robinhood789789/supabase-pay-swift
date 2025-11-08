-- Add Viewer role creation to handle_new_user function
-- First, let's add viewer permissions for existing tenants (one-time setup)
DO $$
DECLARE
  t_id uuid;
  viewer_role_id uuid;
BEGIN
  -- For each existing tenant, create a viewer role if it doesn't exist
  FOR t_id IN SELECT id FROM public.tenants
  LOOP
    -- Check if viewer role exists for this tenant
    SELECT id INTO viewer_role_id
    FROM public.roles
    WHERE tenant_id = t_id AND name = 'viewer';
    
    -- If viewer role doesn't exist, create it
    IF viewer_role_id IS NULL THEN
      INSERT INTO public.roles (tenant_id, name, description, is_system)
      VALUES (t_id, 'viewer', 'Viewer with read-only access to financial data', true)
      RETURNING id INTO viewer_role_id;
      
      -- Grant viewer permissions (read-only financial access)
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT viewer_role_id, id FROM public.permissions
      WHERE name IN (
        'dashboard.view',
        'deposits.view',
        'withdrawals.view',
        'payments.view',
        'customers.view',
        'settlements.view',
        'reports.view'
      );
    END IF;
  END LOOP;
END $$;

-- Update handle_new_user function to include viewer role creation
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
  viewer_role_id uuid;
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
  
  -- Create Viewer role
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'viewer', 'Viewer with read-only access to financial data', true)
  RETURNING id INTO viewer_role_id;
  
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
  
  -- Viewer: read-only access to financial data
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT viewer_role_id, id FROM public.permissions
  WHERE name IN (
    'dashboard.view',
    'deposits.view',
    'withdrawals.view',
    'payments.view',
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