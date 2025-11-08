-- Fix audit_security_change trigger function to match audit_logs table structure
CREATE OR REPLACE FUNCTION public.audit_security_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    TG_OP || '_user_security',
    'profiles:' || COALESCE(NEW.id::text, OLD.id::text),
    to_jsonb(OLD),
    to_jsonb(NEW),
    inet_client_addr()::text,
    current_setting('request.headers', true)::json->>'user-agent'
  );
  RETURN NEW;
END;
$$;