-- Create api_keys table
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  prefix text NOT NULL UNIQUE,
  hashed_secret text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view API keys in their tenant
CREATE POLICY "Users can view api keys in their tenant"
ON public.api_keys FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policy: Users with api_keys:manage permission can manage keys
CREATE POLICY "Users can manage api keys in their tenant"
ON public.api_keys FOR ALL
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add index for faster lookups
CREATE INDEX idx_api_keys_tenant_id ON public.api_keys(tenant_id);
CREATE INDEX idx_api_keys_prefix ON public.api_keys(prefix) WHERE revoked_at IS NULL;