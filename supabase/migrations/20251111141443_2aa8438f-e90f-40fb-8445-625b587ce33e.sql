-- Allow tenant admins to update memberships (status and role)
CREATE POLICY "Tenant admins can update memberships"
ON public.memberships
FOR UPDATE
USING (
  is_super_admin(auth.uid()) OR
  EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = memberships.tenant_id
      AND r.name IN ('owner','manager')
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR
  EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = memberships.tenant_id
      AND r.name IN ('owner','manager')
  )
);