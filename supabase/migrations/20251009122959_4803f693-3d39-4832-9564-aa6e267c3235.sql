-- Create rate_limits table for rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint_window 
ON public.rate_limits(identifier, endpoint, window_start);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at on rate_limits
CREATE TRIGGER update_rate_limits_updated_at
BEFORE UPDATE ON public.rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add 2FA columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS totp_secret text,
ADD COLUMN IF NOT EXISTS totp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS totp_backup_codes text[];

-- Add security settings to tenant_settings
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS enforce_2fa_roles jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS security_headers jsonb DEFAULT '{}'::jsonb;

-- Add CSRF token tracking table
CREATE TABLE IF NOT EXISTS public.csrf_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient CSRF token lookups
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user_token 
ON public.csrf_tokens(user_id, token);

CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires 
ON public.csrf_tokens(expires_at);

-- Enable RLS on csrf_tokens
ALTER TABLE public.csrf_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own CSRF tokens
CREATE POLICY "Users can manage their own csrf tokens"
ON public.csrf_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add indexes to audit_logs for efficient filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action 
ON public.audit_logs(tenant_id, action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_actor 
ON public.audit_logs(tenant_id, actor_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created 
ON public.audit_logs(tenant_id, created_at DESC);