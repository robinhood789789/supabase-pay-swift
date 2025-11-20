-- Add NAW-112233 to tenant "ปอร์เช่" as viewer
DO $$
DECLARE
  naw_user_id uuid := '36bb6ab9-3e8d-4ca2-8f76-07683e82b653';
  target_tenant_id uuid := '7b63509c-55a6-47be-b1c2-e24fd5f19b85';
  viewer_role_id uuid := 'ab0ec110-a16d-4345-8b86-611fe16d29d5';
BEGIN
  -- Insert membership for NAW-112233
  INSERT INTO memberships (user_id, tenant_id, role_id, status)
  VALUES (naw_user_id, target_tenant_id, viewer_role_id, 'active')
  ON CONFLICT DO NOTHING;
  
  -- Log the action
  INSERT INTO audit_logs (
    tenant_id,
    actor_user_id,
    action,
    target,
    after
  ) VALUES (
    target_tenant_id,
    naw_user_id,
    'add_member',
    'memberships',
    jsonb_build_object(
      'user_id', naw_user_id,
      'role', 'viewer',
      'public_id', 'NAW-112233'
    )
  );
END $$;