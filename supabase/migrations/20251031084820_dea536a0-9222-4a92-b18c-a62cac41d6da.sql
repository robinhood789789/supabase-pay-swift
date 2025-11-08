-- ==========================================
-- Fix Critical Security Warnings: Restrict Access to Sensitive Data
-- ==========================================

-- ============================================
-- 1. Fix API Keys Access - Only creator and owner should see API keys
-- ============================================
DROP POLICY IF EXISTS "Users can view api keys in their tenant" ON public.api_keys;
DROP POLICY IF EXISTS "Users can manage api keys in their tenant" ON public.api_keys;

-- Only the user who created the key, owners, or super admins can view API keys
CREATE POLICY "Users can view their own api keys"
ON public.api_keys
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = api_keys.tenant_id
    AND r.name = 'owner'
  )
);

-- Only owners and super admins can manage API keys
CREATE POLICY "Owners can manage api keys"
ON public.api_keys
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = api_keys.tenant_id
    AND r.name = 'owner'
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = api_keys.tenant_id
    AND r.name = 'owner'
  )
);

-- ============================================
-- 2. Fix Webhooks Access - Only owners should see webhook secrets
-- ============================================
DROP POLICY IF EXISTS "Users can view webhooks in their tenant" ON public.webhooks;

CREATE POLICY "Owners can view webhooks"
ON public.webhooks
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = webhooks.tenant_id
    AND r.name = 'owner'
  )
);

CREATE POLICY "Owners can manage webhooks"
ON public.webhooks
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = webhooks.tenant_id
    AND r.name = 'owner'
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = webhooks.tenant_id
    AND r.name = 'owner'
  )
);

-- ============================================
-- 3. Fix Audit Logs - Prevent tampering with audit logs
-- ============================================

-- Only service role and super admins can insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt()->>'role' = 'service_role')
  OR is_super_admin(auth.uid())
);

-- Prevent anyone from updating or deleting audit logs (immutable)
CREATE POLICY "Audit logs are immutable"
ON public.audit_logs
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Audit logs cannot be deleted"
ON public.audit_logs
FOR DELETE
TO authenticated
USING (false);

-- ============================================
-- 4. Fix CSRF Tokens - Separate policies for each operation
-- ============================================
DROP POLICY IF EXISTS "Users can manage their own csrf tokens" ON public.csrf_tokens;

CREATE POLICY "Users can view their own csrf tokens"
ON public.csrf_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own csrf tokens"
ON public.csrf_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own csrf tokens"
ON public.csrf_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own csrf tokens"
ON public.csrf_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);