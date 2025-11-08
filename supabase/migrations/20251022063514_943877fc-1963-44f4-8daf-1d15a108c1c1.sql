-- Fix search_path for request_tenant function
CREATE OR REPLACE FUNCTION public.request_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json->>'x-tenant', '')::uuid;
$$;