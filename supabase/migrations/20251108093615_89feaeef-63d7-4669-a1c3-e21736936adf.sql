-- Tenants RLS Policies
CREATE POLICY "Users can view tenants they belong to" ON public.tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage all tenants" ON public.tenants
  FOR ALL USING (is_super_admin(auth.uid()));

-- Shareholders RLS Policies
CREATE POLICY "Shareholders can view their own data" ON public.shareholders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Shareholders can update their own data" ON public.shareholders
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all shareholders" ON public.shareholders
  FOR ALL USING (is_super_admin(auth.uid()));

-- Shareholder Clients RLS Policies
CREATE POLICY "Shareholders can view their clients" ON public.shareholder_clients
  FOR SELECT USING (shareholder_id = get_shareholder_id(auth.uid()));

CREATE POLICY "Shareholders can update their clients commission" ON public.shareholder_clients
  FOR UPDATE USING (shareholder_id = get_shareholder_id(auth.uid()));

CREATE POLICY "Super admins can manage all shareholder clients" ON public.shareholder_clients
  FOR ALL USING (is_super_admin(auth.uid()));

-- Shareholder Earnings RLS Policies
CREATE POLICY "Shareholders can view their earnings" ON public.shareholder_earnings
  FOR SELECT USING (shareholder_id = get_shareholder_id(auth.uid()));

CREATE POLICY "Super admins can view all earnings" ON public.shareholder_earnings
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Transactions RLS Policies
CREATE POLICY "Users can view transactions in their tenant" ON public.transactions
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Shareholders can view their transactions" ON public.transactions
  FOR SELECT USING (
    shareholder_id IN (
      SELECT id FROM shareholders WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Authorized users can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid()
      AND r.name IN ('owner', 'admin', 'manager', 'finance')
    ) AND created_by_id = auth.uid()
  );

CREATE POLICY "Authorized users can update transactions" ON public.transactions
  FOR UPDATE USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid()
      AND r.name IN ('owner', 'admin', 'manager', 'finance')
    )
  );

CREATE POLICY "Super admins can manage all transactions" ON public.transactions
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Service role can manage all transactions" ON public.transactions
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Tenant Wallets RLS Policies
CREATE POLICY "Users can view their tenant wallet" ON public.tenant_wallets
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Payments RLS Policies
CREATE POLICY "Users can view payments in their tenant" ON public.payments
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Audit Logs RLS Policies
CREATE POLICY "Users can view audit logs in their tenant" ON public.audit_logs
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Super admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role' OR is_super_admin(auth.uid())
  );

CREATE POLICY "Audit logs are immutable" ON public.audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "Audit logs cannot be deleted" ON public.audit_logs
  FOR DELETE USING (false);

-- Roles RLS Policies
CREATE POLICY "Anyone can view roles" ON public.roles
  FOR SELECT USING (true);

-- Memberships RLS Policies
CREATE POLICY "Users can view their own memberships" ON public.memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all memberships" ON public.memberships
  FOR SELECT USING (is_super_admin(auth.uid()));