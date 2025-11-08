-- Fix security warnings: Add missing RLS policies and update function search paths

-- Add RLS policies for provider_events (service role only for webhook processing)
CREATE POLICY "Service role can manage provider events"
ON public.provider_events FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Update function search paths to be immutable
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT tenant_id FROM public.memberships WHERE user_id = user_uuid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_role_in_tenant(user_uuid uuid, role_name text, tenant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = user_uuid
      AND m.tenant_id = tenant_uuid
      AND r.name = role_name
  );
$$;