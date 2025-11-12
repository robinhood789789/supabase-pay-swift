-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper: validate base64 input safely
CREATE OR REPLACE FUNCTION public.is_valid_base64(input text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
  decoded bytea;
BEGIN
  IF input IS NULL OR length(input) = 0 THEN
    RETURN false;
  END IF;
  cleaned := replace(replace(replace(input, E'\n',''), E'\r',''), ' ', '');
  -- Quick character check
  IF cleaned !~ '^[A-Za-z0-9+/=]+$' THEN
    RETURN false;
  END IF;
  -- Must be multiple of 4
  IF length(cleaned) % 4 <> 0 THEN
    RETURN false;
  END IF;
  BEGIN
    decoded := decode(cleaned, 'base64');
    RETURN decoded IS NOT NULL;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
END;
$$;

-- Fix: make decrypt_totp_secret tolerant to legacy plaintext secrets
DROP FUNCTION IF EXISTS public.decrypt_totp_secret(text);
CREATE OR REPLACE FUNCTION public.decrypt_totp_secret(encrypted_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
  cleaned text;
BEGIN
  IF encrypted_secret IS NULL OR encrypted_secret = '' THEN
    RETURN NULL;
  END IF;

  cleaned := replace(replace(replace(encrypted_secret, E'\n',''), E'\r',''), ' ', '');

  IF public.is_valid_base64(cleaned) THEN
    -- Retrieve encryption key
    SELECT key_value INTO encryption_key
    FROM public.encryption_keys
    WHERE key_name = 'totp_encryption_key'
    LIMIT 1;

    IF encryption_key IS NULL THEN
      RAISE EXCEPTION 'Encryption key not found';
    END IF;

    BEGIN
      RETURN convert_from(
        decrypt(
          decode(cleaned, 'base64'),
          encryption_key::bytea,
          'aes'
        ),
        'UTF8'
      );
    EXCEPTION WHEN others THEN
      -- Decryption failed (corruption or key mismatch)
      RETURN NULL;
    END;
  ELSE
    -- Not base64: assume legacy plaintext Base32 TOTP secret
    RETURN encrypted_secret;
  END IF;
END;
$$;

-- Backfill: encrypt any legacy plaintext TOTP secrets
DO $$
BEGIN
  UPDATE public.profiles
  SET totp_secret = public.encrypt_totp_secret(totp_secret)
  WHERE totp_secret IS NOT NULL
    AND totp_secret <> ''
    AND NOT public.is_valid_base64(totp_secret);
END $$;
