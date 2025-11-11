-- Allow tenant owners and managers to view all memberships in their tenant
CREATE POLICY "Tenant owners and managers can view tenant memberships"
ON public.memberships
FOR SELECT
USING (
  tenant_id IN (
    SELECT m.tenant_id 
    FROM memberships m
    JOIN roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid() 
    AND r.name IN ('owner', 'manager')
  )
);