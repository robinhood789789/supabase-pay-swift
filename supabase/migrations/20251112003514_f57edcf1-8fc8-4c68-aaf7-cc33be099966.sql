-- Fix recursive RLS on memberships causing sidebar to show viewer-only
-- 1) Create SECURITY DEFINER helper to check if a user is owner/manager of a tenant
CREATE OR REPLACE FUNCTION public.can_view_tenant_memberships(_uid uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = _uid
      AND m.tenant_id = _tenant_id
      AND r.name IN ('owner', 'manager')
  );
$$;

-- 2) Replace recursive SELECT policy with function-based policy to avoid recursion
DROP POLICY IF EXISTS "Tenant owners and managers can view tenant memberships" ON public.memberships;

CREATE POLICY "Tenant owners and managers can view tenant memberships"
ON public.memberships
FOR SELECT
USING (public.can_view_tenant_memberships(auth.uid(), tenant_id));

-- Keep existing "Users can view their own memberships" and super admin policy intact
-- No changes needed for those.