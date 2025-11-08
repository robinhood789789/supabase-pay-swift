-- Create webhook_dlq table for Dead Letter Queue
CREATE TABLE IF NOT EXISTS public.webhook_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_status ON public.webhook_dlq(status);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_tenant ON public.webhook_dlq(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_next_retry ON public.webhook_dlq(next_retry_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.webhook_dlq ENABLE ROW LEVEL SECURITY;

-- Super admins can view all webhook DLQ entries
CREATE POLICY "Super admins can view all webhook DLQ"
ON public.webhook_dlq
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can manage webhook DLQ
CREATE POLICY "Super admins can manage webhook DLQ"
ON public.webhook_dlq
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Service role can insert webhook DLQ entries
CREATE POLICY "Service role can insert webhook DLQ"
ON public.webhook_dlq
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'fees', 'features', 'maintenance', 'webhooks')),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON public.platform_settings(category);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings(setting_key);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can manage platform settings
CREATE POLICY "Super admins can manage platform settings"
ON public.platform_settings
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Insert default platform settings
INSERT INTO public.platform_settings (setting_key, setting_value, description, category) VALUES
  ('default_fee_percentage', '{"value": 2.9}'::jsonb, 'Default percentage fee for new tenants', 'fees'),
  ('default_fee_fixed', '{"value": 3.0}'::jsonb, 'Default fixed fee per transaction (THB)', 'fees'),
  ('maintenance_mode', '{"enabled": false, "message": "ระบบอยู่ระหว่างการปรับปรุง กรุณากลับมาใหม่ภายหลัง"}'::jsonb, 'Maintenance mode configuration', 'maintenance'),
  ('new_tenant_auto_approve', '{"enabled": false}'::jsonb, 'Auto-approve new tenant registrations', 'features'),
  ('webhook_retry_max', '{"value": 5}'::jsonb, 'Maximum webhook retry attempts', 'webhooks'),
  ('webhook_retry_backoff_seconds', '{"value": 300}'::jsonb, 'Webhook retry backoff duration (seconds)', 'webhooks')
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_platform_settings_updated_at();

-- Create trigger for webhook_dlq updated_at
CREATE TRIGGER update_webhook_dlq_updated_at
BEFORE UPDATE ON public.webhook_dlq
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();