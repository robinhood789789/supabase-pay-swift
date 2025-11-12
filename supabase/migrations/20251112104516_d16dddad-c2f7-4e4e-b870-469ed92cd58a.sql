-- Fix: Correct pgcrypto function references in TOTP encryption functions
-- The issue: pgcrypto is an extension, not a schema. Its functions are in public schema.

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.encrypt_totp_secret(text);
DROP FUNCTION IF EXISTS public.decrypt_totp_secret(text);

-- Create encryption function with correct references
CREATE OR REPLACE FUNCTION public.encrypt_totp_secret(secret_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Retrieve encryption key
  SELECT key_value INTO encryption_key
  FROM public.encryption_keys
  WHERE key_name = 'totp_encryption_key'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Encrypt using AES-256 (encrypt function is from pgcrypto extension in public schema)
  RETURN encode(
    encrypt(
      secret_text::bytea,
      encryption_key::bytea,
      'aes'
    ),
    'base64'
  );
END;
$$;

-- Create decryption function with correct references
CREATE OR REPLACE FUNCTION public.decrypt_totp_secret(encrypted_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_secret IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Retrieve encryption key
  SELECT key_value INTO encryption_key
  FROM public.encryption_keys
  WHERE key_name = 'totp_encryption_key'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Decrypt using AES-256 (decrypt function is from pgcrypto extension in public schema)
  RETURN convert_from(
    decrypt(
      decode(encrypted_secret, 'base64'),
      encryption_key::bytea,
      'aes'
    ),
    'UTF8'
  );
END;
$$;