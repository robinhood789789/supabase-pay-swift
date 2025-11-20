
-- Add KAI-112233 to tenant as viewer
DO $$
DECLARE
  kai_user_id uuid := '46a4207c-a271-4b04-aa20-1963377f1c07';
  target_tenant_id uuid := '7b63509c-55a6-47be-b1c2-e24fd5f19b85';
  viewer_role_id uuid;
BEGIN
  -- Get viewer role ID
  SELECT id INTO viewer_role_id FROM roles WHERE name = 'viewer';
  
  -- Insert membership for KAI-112233
  INSERT INTO memberships (user_id, tenant_id, role_id, status)
  VALUES (kai_user_id, target_tenant_id, viewer_role_id, 'active')
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
    kai_user_id,
    'add_member',
    'memberships',
    jsonb_build_object(
      'user_id', kai_user_id,
      'role', 'viewer',
      'public_id', 'KAI-112233'
    )
  );
END $$;
