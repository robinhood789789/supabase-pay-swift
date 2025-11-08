-- Drop and recreate role_permissions with correct structure
DROP TABLE IF EXISTS public.role_permissions CASCADE;

CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for role_permissions
CREATE POLICY "Anyone can view role permissions" ON public.role_permissions
  FOR SELECT USING (true);

-- Now add the policies that failed earlier
CREATE POLICY "Users can view temporary codes they issued" ON public.temporary_codes
  FOR SELECT USING (issued_by = auth.uid());

CREATE POLICY "Shareholders can view codes for their clients" ON public.temporary_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shareholder_clients sc
      WHERE sc.tenant_id = temporary_codes.tenant_id
      AND sc.shareholder_id = get_shareholder_id(auth.uid())
    )
  );

CREATE POLICY "Super admins can manage all temporary codes" ON public.temporary_codes
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Service role can manage temporary codes" ON public.temporary_codes
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Super admins can manage platform settings" ON public.platform_settings
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage platform security" ON public.platform_security_policy
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their tenant security policy" ON public.tenant_security_policy
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage their tenant security policy" ON public.tenant_security_policy
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid()
      AND m.tenant_id = tenant_security_policy.tenant_id
      AND r.name = 'owner'
    )
  );

CREATE POLICY "Users can view refunds in their tenant" ON public.refunds
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view disputes in their tenant" ON public.disputes
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view settlements in their tenant" ON public.settlements
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view checkout sessions in their tenant" ON public.checkout_sessions
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view payment links in their tenant" ON public.payment_links
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view webhook events in their tenant" ON public.webhook_events
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view approvals in their tenant" ON public.approvals
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view role assignments in their tenant" ON public.role_assignments_log
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view own tenant KYC documents" ON public.kyc_documents
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert KYC documents" ON public.kyc_documents
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Super admins can view all KYC documents" ON public.kyc_documents
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update KYC documents" ON public.kyc_documents
  FOR UPDATE USING (is_super_admin(auth.uid()));