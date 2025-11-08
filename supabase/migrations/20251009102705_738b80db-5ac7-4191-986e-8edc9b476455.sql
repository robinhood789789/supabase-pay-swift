-- Create tenant_settings table for provider configuration
CREATE TABLE public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  features jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their tenant settings
CREATE POLICY "Users can view their tenant settings"
ON public.tenant_settings
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Policy: Owners can manage their tenant settings
CREATE POLICY "Owners can manage their tenant settings"
ON public.tenant_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = tenant_settings.tenant_id
      AND r.name = 'owner'
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_tenant_settings_updated_at
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create idempotency_keys table for idempotent requests
CREATE TABLE public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(tenant_id, key)
);

-- Enable RLS on idempotency_keys
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage idempotency keys
CREATE POLICY "Service role can manage idempotency keys"
ON public.idempotency_keys
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Index for cleanup of expired keys
CREATE INDEX idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);

-- Index for lookup
CREATE INDEX idx_idempotency_keys_tenant_key ON public.idempotency_keys(tenant_id, key);