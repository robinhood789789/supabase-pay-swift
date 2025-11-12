-- Fix: Encrypt TOTP secrets using pgcrypto
-- This prevents complete 2FA bypass if database is compromised

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key storage (in production, use Supabase Vault)
-- For now, using a generated key stored securely
DO $$
DECLARE
  encryption_key text;
BEGIN
  -- Generate a strong encryption key (32 bytes for AES-256)
  encryption_key := encode(gen_random_bytes(32), 'hex');
  
  -- Store in a secure table (better: use Supabase Vault in production)
  CREATE TABLE IF NOT EXISTS public.encryption_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name text UNIQUE NOT NULL,
    key_value text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
  );
  
  -- Insert the encryption key if it doesn't exist
  INSERT INTO public.encryption_keys (key_name, key_value)
  VALUES ('totp_encryption_key', encryption_key)
  ON CONFLICT (key_name) DO NOTHING;
END $$;

-- Lock down encryption_keys table
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only service role and super admins can access encryption keys
CREATE POLICY "Service role and super admins only"
ON public.encryption_keys FOR ALL
USING (
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR is_super_admin(auth.uid())
);

-- Create encryption function
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
  
  -- Encrypt using AES-256
  RETURN encode(
    pgcrypto.encrypt(
      secret_text::bytea,
      encryption_key::bytea,
      'aes'
    ),
    'base64'
  );
END;
$$;

-- Create decryption function
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
  
  -- Decrypt using AES-256
  RETURN convert_from(
    pgcrypto.decrypt(
      decode(encrypted_secret, 'base64'),
      encryption_key::bytea,
      'aes'
    ),
    'UTF8'
  );
END;
$$;

-- Migrate existing TOTP secrets to encrypted format
-- This updates all existing plaintext secrets
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT id, totp_secret 
    FROM public.profiles 
    WHERE totp_secret IS NOT NULL 
    AND totp_secret != ''
  LOOP
    -- Check if it's already encrypted (base64 encoded will have specific length patterns)
    -- If not encrypted, encrypt it
    IF LENGTH(profile_record.totp_secret) < 32 THEN
      -- Looks like plaintext (base32 TOTP secrets are typically 16-32 chars)
      UPDATE public.profiles
      SET totp_secret = public.encrypt_totp_secret(profile_record.totp_secret)
      WHERE id = profile_record.id;
    END IF;
  END LOOP;
END $$;

-- Add comment to remind developers
COMMENT ON COLUMN public.profiles.totp_secret IS 'Encrypted TOTP secret - use decrypt_totp_secret() to read, encrypt_totp_secret() to write';