
-- Add deposits.view and withdrawals.view permissions to viewer role
DO $$
DECLARE
  viewer_role_id uuid;
  deposits_view_perm_id uuid;
  withdrawals_view_perm_id uuid;
BEGIN
  -- Get viewer role ID
  SELECT id INTO viewer_role_id FROM roles WHERE name = 'viewer';
  
  -- Get permission IDs
  SELECT id INTO deposits_view_perm_id FROM permissions WHERE name = 'deposits.view';
  SELECT id INTO withdrawals_view_perm_id FROM permissions WHERE name = 'withdrawals.view';
  
  -- Add deposits.view permission to viewer if not exists
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES (viewer_role_id, deposits_view_perm_id)
  ON CONFLICT DO NOTHING;
  
  -- Add withdrawals.view permission to viewer if not exists
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES (viewer_role_id, withdrawals_view_perm_id)
  ON CONFLICT DO NOTHING;
END $$;
