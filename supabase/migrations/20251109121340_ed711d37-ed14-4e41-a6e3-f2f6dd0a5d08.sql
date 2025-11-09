-- Create security events table for detailed tracking
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'failed_login', 'rate_limit_violation', 'suspicious_api_usage', 'mfa_failure', 'csrf_violation'
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  event_data JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  endpoint TEXT,
  request_id TEXT,
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create security alerts table for admin notifications
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive')),
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create security metrics summary table
CREATE TABLE IF NOT EXISTS public.security_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  failed_login_attempts INTEGER DEFAULT 0,
  rate_limit_violations INTEGER DEFAULT 0,
  suspicious_api_calls INTEGER DEFAULT 0,
  mfa_failures INTEGER DEFAULT 0,
  csrf_violations INTEGER DEFAULT 0,
  blocked_requests INTEGER DEFAULT 0,
  unique_attackers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, metric_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON public.security_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON public.security_events(ip_address);

CREATE INDEX IF NOT EXISTS idx_security_alerts_tenant ON public.security_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON public.security_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_metrics_tenant ON public.security_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_metrics_date ON public.security_metrics(metric_date DESC);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_events
CREATE POLICY "Super admins can view all security events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their security events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      JOIN public.roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- RLS Policies for security_alerts
CREATE POLICY "Super admins can manage all security alerts"
  ON public.security_alerts FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their security alerts"
  ON public.security_alerts FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      JOIN public.roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- RLS Policies for security_metrics
CREATE POLICY "Super admins can view all security metrics"
  ON public.security_metrics FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their security metrics"
  ON public.security_metrics FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      JOIN public.roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- Function to update security metrics
CREATE OR REPLACE FUNCTION public.update_security_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.security_metrics (
    tenant_id,
    metric_date,
    failed_login_attempts,
    rate_limit_violations,
    suspicious_api_calls,
    mfa_failures,
    csrf_violations,
    blocked_requests,
    unique_attackers
  )
  SELECT
    COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    CURRENT_DATE,
    CASE WHEN NEW.event_type = 'failed_login' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'rate_limit_violation' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'suspicious_api_usage' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'mfa_failure' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'csrf_violation' THEN 1 ELSE 0 END,
    CASE WHEN NEW.blocked THEN 1 ELSE 0 END,
    1
  ON CONFLICT (tenant_id, metric_date)
  DO UPDATE SET
    failed_login_attempts = public.security_metrics.failed_login_attempts + 
      CASE WHEN NEW.event_type = 'failed_login' THEN 1 ELSE 0 END,
    rate_limit_violations = public.security_metrics.rate_limit_violations + 
      CASE WHEN NEW.event_type = 'rate_limit_violation' THEN 1 ELSE 0 END,
    suspicious_api_calls = public.security_metrics.suspicious_api_calls + 
      CASE WHEN NEW.event_type = 'suspicious_api_usage' THEN 1 ELSE 0 END,
    mfa_failures = public.security_metrics.mfa_failures + 
      CASE WHEN NEW.event_type = 'mfa_failure' THEN 1 ELSE 0 END,
    csrf_violations = public.security_metrics.csrf_violations + 
      CASE WHEN NEW.event_type = 'csrf_violation' THEN 1 ELSE 0 END,
    blocked_requests = public.security_metrics.blocked_requests + 
      CASE WHEN NEW.blocked THEN 1 ELSE 0 END,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger for security metrics
CREATE TRIGGER trg_update_security_metrics
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_security_metrics();

-- Function to create security alerts based on thresholds
CREATE OR REPLACE FUNCTION public.check_security_thresholds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  event_count INTEGER;
  alert_severity TEXT;
  alert_title TEXT;
  alert_description TEXT;
BEGIN
  -- Check for repeated failed login attempts from same IP
  IF NEW.event_type = 'failed_login' THEN
    SELECT COUNT(*) INTO event_count
    FROM public.security_events
    WHERE ip_address = NEW.ip_address
    AND event_type = 'failed_login'
    AND created_at > now() - interval '15 minutes';
    
    IF event_count >= 5 THEN
      alert_severity := 'high';
      alert_title := 'Multiple Failed Login Attempts Detected';
      alert_description := format('IP %s has failed %s login attempts in the last 15 minutes', NEW.ip_address::text, event_count);
      
      INSERT INTO public.security_alerts (
        tenant_id, alert_type, severity, title, description, event_count, metadata
      ) VALUES (
        NEW.tenant_id,
        'failed_login_threshold',
        alert_severity,
        alert_title,
        alert_description,
        event_count,
        jsonb_build_object('ip_address', NEW.ip_address, 'user_agent', NEW.user_agent)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Check for rate limit violations
  IF NEW.event_type = 'rate_limit_violation' THEN
    SELECT COUNT(*) INTO event_count
    FROM public.security_events
    WHERE ip_address = NEW.ip_address
    AND event_type = 'rate_limit_violation'
    AND created_at > now() - interval '1 hour';
    
    IF event_count >= 10 THEN
      alert_severity := 'medium';
      alert_title := 'Excessive Rate Limit Violations';
      alert_description := format('IP %s has triggered %s rate limit violations in the last hour', NEW.ip_address::text, event_count);
      
      INSERT INTO public.security_alerts (
        tenant_id, alert_type, severity, title, description, event_count, metadata
      ) VALUES (
        NEW.tenant_id,
        'rate_limit_abuse',
        alert_severity,
        alert_title,
        alert_description,
        event_count,
        jsonb_build_object('ip_address', NEW.ip_address, 'endpoint', NEW.endpoint)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for security alerts
CREATE TRIGGER trg_check_security_thresholds
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_security_thresholds();

-- Enable realtime for security tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_metrics;