-- Add webhook-related permissions
INSERT INTO public.permissions (name, description) VALUES
  ('webhooks.view', 'View webhook events and logs'),
  ('webhooks.manage', 'Create, update, and delete webhook endpoints'),
  ('webhooks.test', 'Test webhook endpoints'),
  ('webhooks.retry', 'Retry failed webhook deliveries')
ON CONFLICT (name) DO NOTHING;

-- Update role permissions for webhook functionality
-- Owner: Full access to webhooks
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'owner' AND r.is_system = true
  AND p.name IN ('webhooks.view', 'webhooks.manage', 'webhooks.test', 'webhooks.retry')
ON CONFLICT DO NOTHING;

-- Developer: Manage and test webhooks (technical role)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'developer' AND r.is_system = true
  AND p.name IN ('webhooks.view', 'webhooks.manage', 'webhooks.test')
ON CONFLICT DO NOTHING;

-- Manager: View and retry webhooks
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'manager' AND r.is_system = true
  AND p.name IN ('webhooks.view', 'webhooks.retry')
ON CONFLICT DO NOTHING;

-- Finance: View webhooks only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'finance' AND r.is_system = true
  AND p.name IN ('webhooks.view')
ON CONFLICT DO NOTHING;