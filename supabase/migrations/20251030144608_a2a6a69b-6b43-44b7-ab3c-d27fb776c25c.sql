-- Fix search_path for shareholder functions
CREATE OR REPLACE FUNCTION public.is_shareholder(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shareholders
    WHERE user_id = user_uuid AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_shareholder_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT id FROM public.shareholders
  WHERE user_id = user_uuid AND status = 'active'
  LIMIT 1;
$$;