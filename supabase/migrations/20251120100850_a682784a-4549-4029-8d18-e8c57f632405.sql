-- Update NAW-112233 role from viewer to manager
UPDATE memberships
SET role_id = 'c94deb94-8bd8-4994-b70b-f462d48caa04'
WHERE user_id = '36bb6ab9-3e8d-4ca2-8f76-07683e82b653'
  AND tenant_id = '7b63509c-55a6-47be-b1c2-e24fd5f19b85';

-- Log the role change
INSERT INTO audit_logs (
  tenant_id,
  actor_user_id,
  action,
  target,
  before,
  after
) VALUES (
  '7b63509c-55a6-47be-b1c2-e24fd5f19b85',
  '36bb6ab9-3e8d-4ca2-8f76-07683e82b653',
  'update_role',
  'memberships',
  jsonb_build_object('role', 'viewer'),
  jsonb_build_object('role', 'manager', 'public_id', 'NAW-112233')
);