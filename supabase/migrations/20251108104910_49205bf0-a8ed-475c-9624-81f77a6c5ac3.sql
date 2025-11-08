-- Create RPC function to update TOTP secret (bypass schema cache)
CREATE OR REPLACE FUNCTION update_totp_secret(
  user_id uuid,
  new_secret text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET totp_secret = new_secret,
      updated_at = now()
  WHERE id = user_id;
END;
$$;

-- Create RPC function to enable TOTP
CREATE OR REPLACE FUNCTION enable_totp_with_codes(
  user_id uuid,
  backup_codes text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET totp_enabled = true,
      totp_backup_codes = backup_codes,
      updated_at = now()
  WHERE id = user_id;
END;
$$;