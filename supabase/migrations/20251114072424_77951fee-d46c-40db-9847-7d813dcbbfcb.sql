-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Drop and recreate encrypt_totp_secret function with proper pgcrypto syntax
CREATE OR REPLACE FUNCTION public.encrypt_totp_secret(secret_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key_id uuid;
  encrypted_value text;
BEGIN
  -- Get the encryption key ID from vault
  SELECT id INTO encryption_key_id
  FROM vault.decrypted_secrets
  WHERE name = 'totp_encryption_key'
  LIMIT 1;

  -- If no key found, generate and store a new one
  IF encryption_key_id IS NULL THEN
    -- Generate a random encryption key and store in vault
    INSERT INTO vault.secrets (name, secret)
    VALUES ('totp_encryption_key', encode(gen_random_bytes(32), 'base64'))
    RETURNING id INTO encryption_key_id;
  END IF;

  -- Encrypt using Supabase Vault
  encrypted_value := vault.encrypt(
    secret_text::bytea,
    encryption_key_id,
    'aes-gcm'::text
  )::text;

  RETURN encrypted_value;
END;
$function$;