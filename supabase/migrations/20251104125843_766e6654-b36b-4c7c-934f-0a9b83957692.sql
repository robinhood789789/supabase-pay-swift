-- Allow tenant owners to update memberships in their tenant using existing helper function to avoid recursion
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'memberships' 
      AND policyname = 'Owners can update memberships in their tenant'
  ) THEN
    CREATE POLICY "Owners can update memberships in their tenant"
    ON public.memberships
    FOR UPDATE
    USING (
      public.user_has_role_in_tenant(auth.uid(), 'owner', public.memberships.tenant_id)
    )
    WITH CHECK (
      public.user_has_role_in_tenant(auth.uid(), 'owner', public.memberships.tenant_id)
    );
  END IF;
END$$;