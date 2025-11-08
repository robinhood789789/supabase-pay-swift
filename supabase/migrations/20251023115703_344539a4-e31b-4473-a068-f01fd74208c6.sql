-- Fix multi-tenant visibility and Members page access (retry without IF NOT EXISTS)

-- 1) Update memberships SELECT policy to allow viewing memberships for any tenant the user belongs to
DROP POLICY IF EXISTS "Users can view memberships in their tenant" ON public.memberships;
CREATE POLICY "Users can view memberships in any tenant they belong to"
ON public.memberships
FOR SELECT
USING (public.is_member_of_tenant(tenant_id));

-- 2) Update roles SELECT policy to use membership-based access, not only first tenant
DROP POLICY IF EXISTS "Users can view roles in their tenant" ON public.roles;
CREATE POLICY "Users can view roles in their tenants"
ON public.roles
FOR SELECT
USING (public.is_member_of_tenant(tenant_id));

-- 3) Update tenants SELECT policy to allow users to view all tenants they belong to
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view tenants they belong to"
ON public.tenants
FOR SELECT
USING ((id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())) OR public.is_super_admin(auth.uid()));

-- 4) Allow users to view profiles of users who share at least one tenant with them (for Members page)
DROP POLICY IF EXISTS "Users can view profiles in their tenants" ON public.profiles;
CREATE POLICY "Users can view profiles in their tenants"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m_self
    JOIN public.memberships m_target
      ON m_self.tenant_id = m_target.tenant_id
    WHERE m_self.user_id = auth.uid()
      AND m_target.user_id = profiles.id
  )
  OR public.is_super_admin(auth.uid())
);

-- 5) Update role_permissions visibility to not rely on get_user_tenant_id
DROP POLICY IF EXISTS "Users can view role permissions in their tenant" ON public.role_permissions;
CREATE POLICY "Users can view role permissions in their tenants"
ON public.role_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = role_permissions.role_id
      AND public.is_member_of_tenant(r.tenant_id)
  )
);
