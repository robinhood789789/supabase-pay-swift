-- Fix decrypt_totp_secret to properly handle plaintext Base32 secrets
CREATE OR REPLACE FUNCTION public.decrypt_totp_secret(encrypted_secret TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decryption_key_id UUID;
  decrypted_value TEXT;
BEGIN
  -- If the secret is NULL or empty, return NULL
  IF encrypted_secret IS NULL OR encrypted_secret = '' THEN
    RETURN NULL;
  END IF;

  -- Check if this looks like an encrypted value (Base64 encoded)
  -- Encrypted values are typically much longer (100+ chars) and contain Base64 chars like +/=
  -- Plaintext Base32 TOTP secrets are 16-32 chars and only use A-Z and 2-7
  IF length(encrypted_secret) > 50 OR encrypted_secret ~ '[+/=]' THEN
    -- This looks like encrypted data, try to decrypt
    BEGIN
      -- Get the encryption key ID
      SELECT id INTO decryption_key_id
      FROM vault.decrypted_secrets
      WHERE name = 'totp_encryption_key'
      LIMIT 1;

      -- If we have a key, try to decrypt
      IF decryption_key_id IS NOT NULL THEN
        decrypted_value := vault.decrypt(
          encrypted_secret::bytea,
          decryption_key_id,
          'aes-gcm'::text
        )::text;
        
        RETURN decrypted_value;
      END IF;
      
      -- If no key found, return NULL
      RETURN NULL;
    EXCEPTION
      WHEN OTHERS THEN
        -- Decryption failed, might be legacy plaintext
        -- If it looks like valid Base32 (only A-Z and 2-7), return as-is
        IF encrypted_secret ~ '^[A-Z2-7]+$' THEN
          RETURN encrypted_secret;
        END IF;
        RETURN NULL;
    END;
  ELSE
    -- This looks like plaintext Base32 secret
    -- Validate it's actually Base32 format
    IF encrypted_secret ~ '^[A-Z2-7]+$' AND length(encrypted_secret) >= 16 THEN
      RETURN encrypted_secret;
    END IF;
    
    -- Not valid Base32, return NULL
    RETURN NULL;
  END IF;
END;
$$;