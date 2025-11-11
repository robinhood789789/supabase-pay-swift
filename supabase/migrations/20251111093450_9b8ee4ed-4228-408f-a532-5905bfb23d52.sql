-- Seed Permissions for Role-Based Access Control
-- This migration creates all necessary permissions and assigns them to roles

-- Insert all permissions if they don't exist
INSERT INTO public.permissions (id, name, description, category, created_at)
VALUES
  -- Dashboard
  (gen_random_uuid(), 'dashboard.view', 'View dashboard overview and metrics', 'dashboard', now()),
  
  -- Payments
  (gen_random_uuid(), 'payments.view', 'View payment transactions', 'payments', now()),
  (gen_random_uuid(), 'payments.create', 'Create new payment transactions', 'payments', now()),
  (gen_random_uuid(), 'payments.export', 'Export payment data', 'payments', now()),
  
  -- Settlements
  (gen_random_uuid(), 'settlements.view', 'View settlement information', 'settlements', now()),
  
  -- Approvals
  (gen_random_uuid(), 'approvals.view', 'View pending approvals', 'approvals', now()),
  (gen_random_uuid(), 'approvals.decide', 'Approve or reject requests', 'approvals', now()),
  
  -- Alerts
  (gen_random_uuid(), 'alerts.view', 'View security and risk alerts', 'alerts', now()),
  
  -- API Keys
  (gen_random_uuid(), 'api_keys.view', 'View API keys', 'api_keys', now()),
  (gen_random_uuid(), 'api_keys.manage', 'Create, rotate, and revoke API keys', 'api_keys', now()),
  
  -- Webhooks
  (gen_random_uuid(), 'webhooks.view', 'View webhook configurations', 'webhooks', now()),
  (gen_random_uuid(), 'webhooks.test', 'Test webhook endpoints', 'webhooks', now()),
  
  -- Payment Links
  (gen_random_uuid(), 'payment_links.create', 'Create payment links', 'payment_links', now())
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- We'll use a temporary table to map role names to permission names

-- Owner: ALL permissions
DO $$
DECLARE
  owner_role_id uuid;
  perm_record RECORD;
BEGIN
  -- Get owner role ID
  SELECT id INTO owner_role_id FROM public.roles WHERE name = 'owner' LIMIT 1;
  
  IF owner_role_id IS NOT NULL THEN
    -- Assign ALL permissions to owner
    FOR perm_record IN SELECT id FROM public.permissions
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id, created_at)
      VALUES (owner_role_id, perm_record.id, now())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Manager: All except api_keys.manage, webhooks.test
DO $$
DECLARE
  manager_role_id uuid;
  perm_record RECORD;
BEGIN
  SELECT id INTO manager_role_id FROM public.roles WHERE name = 'manager' LIMIT 1;
  
  IF manager_role_id IS NOT NULL THEN
    FOR perm_record IN 
      SELECT id FROM public.permissions 
      WHERE name NOT IN ('api_keys.manage', 'webhooks.test')
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id, created_at)
      VALUES (manager_role_id, perm_record.id, now())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Finance: Financial permissions only
DO $$
DECLARE
  finance_role_id uuid;
  perm_record RECORD;
BEGIN
  SELECT id INTO finance_role_id FROM public.roles WHERE name = 'finance' LIMIT 1;
  
  IF finance_role_id IS NOT NULL THEN
    FOR perm_record IN 
      SELECT id FROM public.permissions 
      WHERE name IN (
        'dashboard.view',
        'payments.view',
        'payments.create',
        'payments.export',
        'settlements.view'
      )
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id, created_at)
      VALUES (finance_role_id, perm_record.id, now())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Developer: Technical permissions only
DO $$
DECLARE
  developer_role_id uuid;
  perm_record RECORD;
BEGIN
  SELECT id INTO developer_role_id FROM public.roles WHERE name = 'developer' LIMIT 1;
  
  IF developer_role_id IS NOT NULL THEN
    FOR perm_record IN 
      SELECT id FROM public.permissions 
      WHERE name IN (
        'api_keys.view',
        'api_keys.manage',
        'webhooks.view',
        'webhooks.test'
      )
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id, created_at)
      VALUES (developer_role_id, perm_record.id, now())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Viewer: Read-only permissions
DO $$
DECLARE
  viewer_role_id uuid;
  perm_record RECORD;
BEGIN
  SELECT id INTO viewer_role_id FROM public.roles WHERE name = 'viewer' LIMIT 1;
  
  IF viewer_role_id IS NOT NULL THEN
    FOR perm_record IN 
      SELECT id FROM public.permissions 
      WHERE name IN (
        'dashboard.view',
        'payments.view',
        'settlements.view'
      )
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id, created_at)
      VALUES (viewer_role_id, perm_record.id, now())
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;