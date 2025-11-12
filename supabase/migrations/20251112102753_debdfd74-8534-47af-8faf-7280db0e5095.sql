-- Fix: Missing RLS on temporary_codes table
-- This prevents unauthorized users from viewing or manipulating one-time codes

ALTER TABLE public.temporary_codes ENABLE ROW LEVEL SECURITY;

-- Users can view codes issued to them or by them
CREATE POLICY "Users can view their own codes"
ON public.temporary_codes FOR SELECT
USING (
  auth.uid() = user_id 
  OR auth.uid() = issued_by
  OR is_super_admin(auth.uid())
);

-- Only authorized users (super admins and tenant owners) can create codes
CREATE POLICY "Authorized users can create codes"
ON public.temporary_codes FOR INSERT
WITH CHECK (
  auth.uid() = issued_by
  AND (
    is_super_admin(auth.uid()) 
    OR user_has_role_in_tenant(auth.uid(), 'owner', tenant_id)
  )
);

-- Only super admins and issuers can update codes
CREATE POLICY "Authorized users can update codes"
ON public.temporary_codes FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR auth.uid() = issued_by
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR auth.uid() = issued_by
);

-- Service role can manage for edge functions
CREATE POLICY "Service role can manage codes"
ON public.temporary_codes FOR ALL
USING (
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_temporary_codes_user_id ON public.temporary_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_temporary_codes_issued_by ON public.temporary_codes(issued_by);
CREATE INDEX IF NOT EXISTS idx_temporary_codes_code ON public.temporary_codes(code);