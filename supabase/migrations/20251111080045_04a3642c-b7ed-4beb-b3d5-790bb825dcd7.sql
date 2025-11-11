-- Fix: Add search_path to update_ip_blocks_updated_at function to prevent search_path manipulation attacks
-- This resolves the SUPA_function_search_path_mutable security warning

CREATE OR REPLACE FUNCTION public.update_ip_blocks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;