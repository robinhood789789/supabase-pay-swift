-- Fix cleanup functions

-- Fix cleanup_replay_cache
CREATE OR REPLACE FUNCTION public.cleanup_replay_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.hmac_replay_cache
  WHERE created_at < now() - interval '10 minutes';
END;
$$;

-- Fix cleanup_expired_codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.temporary_codes
  SET is_active = false,
      updated_at = now()
  WHERE is_active = true
  AND expires_at < now();
END;
$$;