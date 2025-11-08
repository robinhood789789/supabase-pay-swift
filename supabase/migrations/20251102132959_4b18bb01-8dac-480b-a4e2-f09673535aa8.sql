-- ============================================
-- SECURITY HARDENING: Critical Fixes
-- ============================================

-- 1. Add missing RLS policies for profiles table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Super admins can view all profiles'
  ) THEN
    CREATE POLICY "Super admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Super admins can update all profiles'
  ) THEN
    CREATE POLICY "Super admins can update all profiles"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- 2. Fix audit_security_change function - add proper tenant handling
CREATE OR REPLACE FUNCTION public.audit_security_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_tenant_id uuid;
BEGIN
  -- Try to get tenant_id from memberships, but don't fail if none exists
  SELECT tenant_id INTO user_tenant_id
  FROM public.memberships
  WHERE user_id = COALESCE(NEW.id, OLD.id)
  LIMIT 1;
  
  -- Only insert audit log if we have a tenant_id (skip for users without memberships)
  IF user_tenant_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      tenant_id,
      actor_user_id,
      action,
      target,
      before,
      after,
      ip,
      user_agent
    ) VALUES (
      user_tenant_id,
      auth.uid(),
      TG_OP || '_user_security',
      'profiles:' || COALESCE(NEW.id::text, OLD.id::text),
      to_jsonb(OLD),
      to_jsonb(NEW),
      inet_client_addr()::text,
      current_setting('request.headers', true)::json->>'user-agent'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Update all SECURITY DEFINER functions to use pg_temp in search_path
-- This prevents search_path manipulation attacks

-- Fix is_shareholder function
CREATE OR REPLACE FUNCTION public.is_shareholder(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shareholders
    WHERE user_id = user_uuid AND status = 'active'
  );
$$;

-- Fix get_shareholder_id function  
CREATE OR REPLACE FUNCTION public.get_shareholder_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.shareholders
  WHERE user_id = user_uuid AND status = 'active'
  LIMIT 1;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Assign default 'user' role (if user_roles table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::public.app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Create index for profiles security-sensitive queries
CREATE INDEX IF NOT EXISTS idx_profiles_totp_enabled ON public.profiles(id, totp_enabled) WHERE totp_enabled = true;
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin ON public.profiles(id) WHERE is_super_admin = true;

-- Add comment documenting the security hardening
COMMENT ON TABLE public.profiles IS 'User profiles with MFA and security settings. RLS enabled. Super admins can access all profiles.';
COMMENT ON FUNCTION public.audit_security_change() IS 'Audit function for security-sensitive profile changes. Uses SECURITY DEFINER with fixed search_path.';
COMMENT ON FUNCTION public.is_shareholder(UUID) IS 'Check if user is an active shareholder. Uses SECURITY DEFINER with fixed search_path to prevent privilege escalation.';
COMMENT ON FUNCTION public.get_shareholder_id(UUID) IS 'Get shareholder ID from user ID. Uses SECURITY DEFINER with fixed search_path to prevent privilege escalation.';