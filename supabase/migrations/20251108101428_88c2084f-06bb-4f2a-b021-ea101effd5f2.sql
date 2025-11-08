-- Create function to get email by public_id
CREATE OR REPLACE FUNCTION public.get_email_by_public_id(input_public_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  found_email text;
BEGIN
  SELECT email INTO found_email
  FROM public.profiles
  WHERE public_id = input_public_id
  LIMIT 1;
  
  RETURN found_email;
END;
$$;