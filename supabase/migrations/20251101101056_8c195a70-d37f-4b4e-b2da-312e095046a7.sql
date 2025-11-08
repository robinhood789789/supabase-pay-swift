-- Fix audit_security_change function to get tenant_id from memberships table
CREATE OR REPLACE FUNCTION public.audit_security_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_tenant_id uuid;
BEGIN
  -- Get tenant_id from memberships table since profiles doesn't have tenant_id
  SELECT tenant_id INTO user_tenant_id
  FROM public.memberships
  WHERE user_id = COALESCE(NEW.id, OLD.id)
  LIMIT 1;
  
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
  RETURN NEW;
END;
$function$;