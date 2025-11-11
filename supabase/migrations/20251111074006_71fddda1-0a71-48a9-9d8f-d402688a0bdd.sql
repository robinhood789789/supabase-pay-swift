-- Add input validation to get_email_by_public_id function
CREATE OR REPLACE FUNCTION public.get_email_by_public_id(input_public_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  found_email text;
BEGIN
  -- Validate format server-side (PREFIX-NNNNNN format)
  IF input_public_id !~ '^[A-Z0-9]{2,6}-[0-9]{6}$' THEN
    RETURN NULL;
  END IF;
  
  -- Validate length as extra precaution
  IF LENGTH(input_public_id) > 20 THEN
    RETURN NULL;
  END IF;
  
  SELECT email INTO found_email
  FROM public.profiles
  WHERE public_id = input_public_id
  LIMIT 1;
  
  RETURN found_email;
END;
$function$;

-- Add authorization check to assign_super_admin_role_by_email
CREATE OR REPLACE FUNCTION public.assign_super_admin_role_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  -- CRITICAL: Only existing super admins can assign super admin roles
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin privileges required';
  END IF;

  -- Find user by email from auth.users
  SELECT id INTO _user_id
  FROM auth.users
  WHERE email = _email
  LIMIT 1;

  -- If user not found, raise error
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', _email;
  END IF;

  -- Check if user already has super_admin role
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'super_admin'
  ) THEN
    RAISE NOTICE 'User % already has super_admin role', _email;
    RETURN;
  END IF;

  -- Insert super_admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'super_admin');

  RAISE NOTICE 'Super admin role assigned to user %', _email;
END;
$function$;

-- Add authorization check to assign_owner_role_by_email
CREATE OR REPLACE FUNCTION public.assign_owner_role_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  -- CRITICAL: Only super admins can assign owner roles
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin privileges required';
  END IF;

  -- Find user by email from auth.users
  SELECT id INTO _user_id
  FROM auth.users
  WHERE email = _email
  LIMIT 1;

  -- If user not found, raise error
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', _email;
  END IF;

  -- Check if user already has owner role
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'owner'
  ) THEN
    RAISE NOTICE 'User % already has owner role', _email;
    RETURN;
  END IF;

  -- Insert owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'owner');

  RAISE NOTICE 'Owner role assigned to user %', _email;
END;
$function$;

-- Add user validation to enable_totp_with_codes
CREATE OR REPLACE FUNCTION public.enable_totp_with_codes(user_id uuid, backup_codes text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- CRITICAL: Users can only enable TOTP for themselves
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only enable TOTP for your own account';
  END IF;

  UPDATE profiles
  SET totp_enabled = true,
      totp_backup_codes = backup_codes,
      updated_at = now()
  WHERE id = user_id;
END;
$function$;

-- Add user validation to update_totp_secret
CREATE OR REPLACE FUNCTION public.update_totp_secret(user_id uuid, new_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- CRITICAL: Users can only update their own TOTP secret
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only update your own TOTP secret';
  END IF;

  UPDATE profiles
  SET totp_secret = new_secret,
      updated_at = now()
  WHERE id = user_id;
END;
$function$;