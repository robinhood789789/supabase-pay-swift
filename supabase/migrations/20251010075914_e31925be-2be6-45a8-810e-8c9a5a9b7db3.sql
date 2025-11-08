-- Create default permissions if they don't exist
INSERT INTO public.permissions (name, description) VALUES
  ('payments.view', 'View payments'),
  ('payments.create', 'Create payments'),
  ('payments.refund', 'Refund payments'),
  ('customers.view', 'View customers'),
  ('customers.manage', 'Manage customers'),
  ('settlements.view', 'View settlements'),
  ('reports.view', 'View reports'),
  ('api_keys.view', 'View API keys'),
  ('api_keys.manage', 'Manage API keys'),
  ('webhooks.view', 'View webhooks'),
  ('webhooks.manage', 'Manage webhooks'),
  ('settings.view', 'View settings'),
  ('settings.manage', 'Manage settings'),
  ('users.view', 'View users'),
  ('users.manage', 'Manage users')
ON CONFLICT (name) DO NOTHING;

-- Update handle_new_user function to create all default roles
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
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Create tenant for the new user
  INSERT INTO public.tenants (name, status)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Workspace',
    'active'
  )
  RETURNING id INTO new_tenant_id;
  
  -- Create all default roles for this tenant
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'owner', 'Tenant owner with full access', true)
  RETURNING id INTO owner_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'admin', 'Administrator with management access', true)
  RETURNING id INTO admin_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'developer', 'Developer with API access', true)
  RETURNING id INTO developer_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'finance', 'Finance user with payment access', true)
  RETURNING id INTO finance_role_id;
  
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'viewer', 'Read-only access', true)
  RETURNING id INTO viewer_role_id;
  
  -- Assign permissions to roles
  -- Owner: all permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT owner_role_id, id FROM public.permissions;
  
  -- Admin: all except some sensitive settings
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM public.permissions
  WHERE name NOT IN ('settings.manage', 'users.manage');
  
  -- Developer: API and webhook management
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT developer_role_id, id FROM public.permissions
  WHERE name IN ('payments.view', 'customers.view', 'api_keys.view', 'api_keys.manage', 'webhooks.view', 'webhooks.manage', 'settings.view');
  
  -- Finance: payment and settlement related
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT finance_role_id, id FROM public.permissions
  WHERE name IN ('payments.view', 'payments.create', 'payments.refund', 'customers.view', 'settlements.view', 'reports.view');
  
  -- Viewer: read-only access
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT viewer_role_id, id FROM public.permissions
  WHERE name LIKE '%.view';
  
  -- Assign user to tenant with owner role
  INSERT INTO public.memberships (user_id, tenant_id, role_id)
  VALUES (NEW.id, new_tenant_id, owner_role_id);
  
  RETURN NEW;
END;
$function$;