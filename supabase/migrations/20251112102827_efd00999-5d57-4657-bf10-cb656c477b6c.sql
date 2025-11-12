-- Fix: Missing RLS on rate_limits and hmac_replay_cache tables
-- These tables need RLS to prevent unauthorized access to security data

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only view their own rate limits
CREATE POLICY "Users can view own rate limits"
ON public.rate_limits FOR SELECT
USING (identifier = auth.uid()::text);

-- Service role manages rate limits
CREATE POLICY "Service role manages rate limits"
ON public.rate_limits FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Enable RLS on hmac_replay_cache
ALTER TABLE public.hmac_replay_cache ENABLE ROW LEVEL SECURITY;

-- Service role only for webhook processing
CREATE POLICY "Service role manages replay cache"
ON public.hmac_replay_cache FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Super admins can view for debugging
CREATE POLICY "Super admins can view replay cache"
ON public.hmac_replay_cache FOR SELECT
USING (is_super_admin(auth.uid()));