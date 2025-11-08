-- Add key_type enum and enhance API keys table for payment gateway standards

-- Create enum for API key types
CREATE TYPE public.api_key_type AS ENUM ('internal', 'external');

-- Add key_type column to api_keys table
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS key_type public.api_key_type NOT NULL DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS rate_limit_tier text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS allowed_operations jsonb DEFAULT '["read", "write"]'::jsonb,
ADD COLUMN IF NOT EXISTS webhook_endpoints jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_type ON public.api_keys(tenant_id, key_type);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_status_active ON public.api_keys(status, is_active) WHERE revoked_at IS NULL;

-- Add comment documentation
COMMENT ON COLUMN public.api_keys.key_type IS 'Internal: for own systems, External: for partners/third-party';
COMMENT ON COLUMN public.api_keys.rate_limit_tier IS 'Rate limit tier: basic, standard, premium, enterprise';
COMMENT ON COLUMN public.api_keys.allowed_operations IS 'Array of allowed operations: read, write, refund, webhook';
COMMENT ON COLUMN public.api_keys.ip_allowlist IS 'Array of allowed IP addresses or CIDR ranges';
COMMENT ON COLUMN public.api_keys.scope IS 'Endpoint access control configuration';

-- Function to validate API key before use
CREATE OR REPLACE FUNCTION public.validate_api_key_access(
  _prefix text,
  _endpoint text,
  _ip inet
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_record RECORD;
  result jsonb;
BEGIN
  -- Get key details
  SELECT * INTO key_record
  FROM public.api_keys
  WHERE prefix = _prefix
    AND status = 'active'
    AND is_active = true
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'invalid_or_expired'
    );
  END IF;
  
  -- Check IP allowlist (if configured)
  IF jsonb_array_length(key_record.ip_allowlist) > 0 THEN
    -- This is a simplified check, real implementation needs CIDR matching
    IF NOT (SELECT jsonb_array_elements_text(key_record.ip_allowlist) = _ip::text) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'ip_not_allowed'
      );
    END IF;
  END IF;
  
  -- Update last_used_at
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE id = key_record.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'tenant_id', key_record.tenant_id,
    'key_type', key_record.key_type,
    'scope', key_record.scope,
    'allowed_operations', key_record.allowed_operations,
    'rate_limit_tier', key_record.rate_limit_tier
  );
END;
$$;