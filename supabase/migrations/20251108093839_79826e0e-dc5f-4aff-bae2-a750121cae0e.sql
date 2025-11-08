-- Add remaining RLS policies for tables that still need them

-- Admin Activity RLS Policies
CREATE POLICY "Super admins can view admin activity" ON public.admin_activity
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Shareholder Invitations RLS Policies
CREATE POLICY "Super admins can manage shareholder invitations" ON public.shareholder_invitations
  FOR ALL USING (is_super_admin(auth.uid()));

-- Platform Provider Credentials RLS Policies
CREATE POLICY "Super admins can manage platform credentials" ON public.platform_provider_credentials
  FOR ALL USING (is_super_admin(auth.uid()));

-- Platform Provisioning Tokens RLS Policies
CREATE POLICY "Super admins can manage platform tokens" ON public.platform_provisioning_tokens
  FOR ALL USING (is_super_admin(auth.uid()));

-- Provider Events RLS Policies
CREATE POLICY "Service role can manage provider events" ON public.provider_events
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- HMAC Replay Cache RLS Policies
CREATE POLICY "Service role can manage replay cache" ON public.hmac_replay_cache
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- ID Sequences RLS Policies
CREATE POLICY "Service role can manage id_sequences" ON public.id_sequences
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'service_role' OR is_super_admin(auth.uid())
  );

-- Role Templates RLS Policies
CREATE POLICY "Super admins can view role templates" ON public.role_templates
  FOR SELECT USING (is_super_admin(auth.uid()));

-- API Keys RLS Policies
CREATE POLICY "Users can view API keys in their tenant" ON public.api_keys
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

-- Alerts RLS Policies
CREATE POLICY "Users can view alerts in their tenant" ON public.alerts
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

-- Alert Events RLS Policies
CREATE POLICY "Users can view alert events" ON public.alert_events
  FOR SELECT USING (
    alert_id IN (
      SELECT a.id FROM alerts a
      JOIN memberships m ON a.tenant_id = m.tenant_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Customers RLS Policies
CREATE POLICY "Users can view customers in their tenant" ON public.customers
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

-- Guardrails RLS Policies
CREATE POLICY "Users can view guardrails in their tenant" ON public.guardrails
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

-- Go Live Checklist RLS Policies
CREATE POLICY "Users can view checklist in their tenant" ON public.go_live_checklist
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

-- Idempotency Keys RLS Policies
CREATE POLICY "Service role can manage idempotency keys" ON public.idempotency_keys
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Rate Limits RLS Policies
CREATE POLICY "Service role can manage rate limits" ON public.rate_limits
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');