-- Add developer role to each tenant
-- This role is needed for API documentation access

DO $$
DECLARE
  tenant_record RECORD;
  developer_role_id uuid;
BEGIN
  FOR tenant_record IN SELECT id FROM public.tenants LOOP
    -- Check if developer role already exists for this tenant
    SELECT id INTO developer_role_id 
    FROM public.roles 
    WHERE tenant_id = tenant_record.id AND name = 'developer';
    
    -- If not exists, create developer role
    IF developer_role_id IS NULL THEN
      INSERT INTO public.roles (tenant_id, name, description, is_system)
      VALUES (tenant_record.id, 'developer', 'Developer with API access', true)
      RETURNING id INTO developer_role_id;
      
      -- Grant developer permissions
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT developer_role_id, id 
      FROM public.permissions 
      WHERE name IN (
        'payments:read',
        'payments:write',
        'links:read',
        'links:write',
        'api-keys:read',
        'api-keys:write',
        'webhooks:read',
        'webhooks:write'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
