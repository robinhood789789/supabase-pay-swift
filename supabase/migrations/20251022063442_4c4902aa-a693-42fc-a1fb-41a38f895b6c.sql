-- Create platform_security_policy table for global defaults
CREATE TABLE IF NOT EXISTS public.platform_security_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  force_2fa_for_super_admin boolean NOT NULL DEFAULT true,
  default_require_2fa_for_owner boolean NOT NULL DEFAULT true,
  default_require_2fa_for_admin boolean NOT NULL DEFAULT true,
  default_stepup_window_seconds integer NOT NULL DEFAULT 300,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_security_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage platform security"
  ON public.platform_security_policy
  FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Create admin_activity table for super admin tracking
CREATE TABLE IF NOT EXISTS public.admin_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_tenant_id uuid REFERENCES public.tenants(id),
  target_user_id uuid REFERENCES auth.users(id),
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view admin activity"
  ON public.admin_activity
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Create role_templates table for pre-defined role blueprints
CREATE TABLE IF NOT EXISTS public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view role templates"
  ON public.role_templates
  FOR SELECT
  USING (true);

-- Create role_template_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_template_permissions (
  template_id uuid NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (template_id, permission_id)
);

ALTER TABLE public.role_template_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view template permissions"
  ON public.role_template_permissions
  FOR SELECT
  USING (true);

-- Create role_assignments_log for tracking role changes
CREATE TABLE IF NOT EXISTS public.role_assignments_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role_id uuid NOT NULL REFERENCES public.roles(id),
  assigned_by uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('assigned', 'removed')),
  previous_role_id uuid REFERENCES public.roles(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_assignments_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role assignments in their tenant"
  ON public.role_assignments_log
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create guardrails table for risk rules and limits
CREATE TABLE IF NOT EXISTS public.guardrails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  rule_type text NOT NULL,
  rule_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guardrails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view guardrails in their tenant"
  ON public.guardrails
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create approvals table for workflow approvals
CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  action_type text NOT NULL,
  action_data jsonb NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approvals in their tenant"
  ON public.approvals
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create alerts table for system alerts
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts in their tenant"
  ON public.alerts
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR tenant_id IS NULL);

-- Create alert_events table for alert history
CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alert events for their tenant alerts"
  ON public.alert_events
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.alerts
    WHERE alerts.id = alert_events.alert_id
    AND (alerts.tenant_id = get_user_tenant_id(auth.uid()) OR alerts.tenant_id IS NULL)
  ));

-- Create helper function to get tenant from X-Tenant header
CREATE OR REPLACE FUNCTION public.request_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json->>'x-tenant', '')::uuid;
$$;

-- Create helper function to check if user is member of a tenant
CREATE OR REPLACE FUNCTION public.is_member_of_tenant(tenant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = auth.uid()
    AND tenant_id = tenant_uuid
  );
$$;

-- Seed platform_security_policy singleton
INSERT INTO public.platform_security_policy (
  force_2fa_for_super_admin,
  default_require_2fa_for_owner,
  default_require_2fa_for_admin,
  default_stepup_window_seconds
) VALUES (
  true,
  true,
  true,
  300
)
ON CONFLICT DO NOTHING;

-- Seed role templates
INSERT INTO public.role_templates (name, description, is_system) VALUES
  ('finance', 'Finance team with payment and settlement access', true),
  ('support', 'Support team with customer and dispute access', true),
  ('developer', 'Developer with API and webhook access', true),
  ('viewer', 'Read-only access to reports and data', true)
ON CONFLICT (name) DO NOTHING;

-- Seed role template permissions
DO $$
DECLARE
  finance_template_id uuid;
  support_template_id uuid;
  developer_template_id uuid;
  viewer_template_id uuid;
BEGIN
  SELECT id INTO finance_template_id FROM public.role_templates WHERE name = 'finance';
  SELECT id INTO support_template_id FROM public.role_templates WHERE name = 'support';
  SELECT id INTO developer_template_id FROM public.role_templates WHERE name = 'developer';
  SELECT id INTO viewer_template_id FROM public.role_templates WHERE name = 'viewer';

  -- Finance template permissions
  INSERT INTO public.role_template_permissions (template_id, permission_id)
  SELECT finance_template_id, id FROM public.permissions
  WHERE name IN (
    'payments.view', 'payments.create', 'payments.refund',
    'customers.view', 'settlements.view', 'reports.view'
  )
  ON CONFLICT DO NOTHING;

  -- Support template permissions
  INSERT INTO public.role_template_permissions (template_id, permission_id)
  SELECT support_template_id, id FROM public.permissions
  WHERE name IN (
    'customers.view', 'customers.create', 'payments.view', 'disputes.view'
  )
  ON CONFLICT DO NOTHING;

  -- Developer template permissions
  INSERT INTO public.role_template_permissions (template_id, permission_id)
  SELECT developer_template_id, id FROM public.permissions
  WHERE name IN (
    'api_keys.view', 'api_keys.manage', 'webhooks.view', 'webhooks.manage',
    'payments.view', 'customers.view', 'settings.view'
  )
  ON CONFLICT DO NOTHING;

  -- Viewer template permissions
  INSERT INTO public.role_template_permissions (template_id, permission_id)
  SELECT viewer_template_id, id FROM public.permissions
  WHERE name LIKE '%.view'
  ON CONFLICT DO NOTHING;
END $$;

-- Add triggers for updated_at
CREATE TRIGGER update_platform_security_policy_updated_at
  BEFORE UPDATE ON public.platform_security_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_guardrails_updated_at
  BEFORE UPDATE ON public.guardrails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();