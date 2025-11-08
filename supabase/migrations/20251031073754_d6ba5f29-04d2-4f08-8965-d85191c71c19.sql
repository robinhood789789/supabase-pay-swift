-- Add security fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS requires_password_change boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
ADD COLUMN IF NOT EXISTS totp_backup_codes jsonb DEFAULT '[]'::jsonb;

-- Create index for security checks
CREATE INDEX IF NOT EXISTS idx_profiles_security_check 
ON public.profiles(id, totp_enabled, requires_password_change);

-- Update platform_security_policy table
ALTER TABLE public.platform_security_policy
ADD COLUMN IF NOT EXISTS force_2fa_for_all_roles boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS first_login_require_mfa boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS first_login_require_password_change boolean DEFAULT true;

-- Set default values for existing policy
UPDATE public.platform_security_policy 
SET 
  force_2fa_for_all_roles = true,
  first_login_require_mfa = true,
  first_login_require_password_change = true
WHERE id IS NOT NULL;

-- Create audit function for security changes
CREATE OR REPLACE FUNCTION public.audit_security_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    TG_OP,
    'user_security',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'before', to_jsonb(OLD),
      'after', to_jsonb(NEW),
      'changed_fields', CASE 
        WHEN TG_OP = 'UPDATE' THEN
          (SELECT jsonb_object_agg(key, value)
           FROM jsonb_each(to_jsonb(NEW))
           WHERE to_jsonb(NEW) -> key != to_jsonb(OLD) -> key)
        ELSE NULL
      END
    ),
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for security auditing
DROP TRIGGER IF EXISTS audit_profile_security_changes ON public.profiles;
CREATE TRIGGER audit_profile_security_changes
AFTER UPDATE OF totp_enabled, totp_secret, mfa_last_verified_at, requires_password_change, password_changed_at
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.audit_security_change();