-- Create function to lookup email from public_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_email_by_public_id(input_public_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email
  FROM public.profiles
  WHERE public_id = input_public_id
  LIMIT 1;
  
  RETURN user_email;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.get_email_by_public_id IS 'Lookup email by public_id for login purposes. Security definer allows this to bypass RLS.';