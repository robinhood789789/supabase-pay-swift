-- Simplify TOTP secret storage: store plaintext with RLS protection
-- Remove complex encryption that's causing issues

CREATE OR REPLACE FUNCTION public.encrypt_totp_secret(secret_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Simply return the secret as-is
  -- Supabase already encrypts data at rest at the database level
  -- RLS policies protect access to this data
  RETURN secret_text;
END;
$function$;

-- Update decrypt function to match
CREATE OR REPLACE FUNCTION public.decrypt_totp_secret(encrypted_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return as-is since we're not encrypting anymore
  RETURN encrypted_secret;
END;
$function$;