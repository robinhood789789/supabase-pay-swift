-- Fix remaining functions without pg_temp in search_path

-- Fix request_tenant function - add security and search_path
CREATE OR REPLACE FUNCTION public.request_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json->>'x-tenant', '')::uuid;
$$;

-- Fix get_user_tenant_id - add pg_temp
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tenant_id FROM public.memberships WHERE user_id = user_uuid LIMIT 1;
$$;

-- Fix user_has_role_in_tenant - add pg_temp
CREATE OR REPLACE FUNCTION public.user_has_role_in_tenant(user_uuid uuid, role_name text, tenant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Fix is_member_of_tenant - add pg_temp
CREATE OR REPLACE FUNCTION public.is_member_of_tenant(tenant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = auth.uid()
    AND tenant_id = tenant_uuid
  );
$$;

-- Fix validate_api_key_access - add pg_temp
CREATE OR REPLACE FUNCTION public.validate_api_key_access(
  _prefix text,
  _endpoint text,
  _ip inet
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  key_record RECORD;
  result jsonb;
BEGIN
  -- Get key details
  SELECT * INTO key_record
  FROM public.api_keys
  WHERE prefix = _prefix
    AND status = 'active'
    AND is_active = true
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'invalid_or_expired'
    );
  END IF;
  
  -- Check IP allowlist (if configured)
  IF jsonb_array_length(key_record.ip_allowlist) > 0 THEN
    -- This is a simplified check, real implementation needs CIDR matching
    IF NOT (SELECT jsonb_array_elements_text(key_record.ip_allowlist) = _ip::text) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'ip_not_allowed'
      );
    END IF;
  END IF;
  
  -- Update last_used_at
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE id = key_record.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'tenant_id', key_record.tenant_id,
    'key_type', key_record.key_type,
    'scope', key_record.scope,
    'allowed_operations', key_record.allowed_operations,
    'rate_limit_tier', key_record.rate_limit_tier
  );
END;
$$;

-- Fix update_tenant_kyc_status - add pg_temp
CREATE OR REPLACE FUNCTION public.update_tenant_kyc_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  approved_docs_count INTEGER;
  required_docs_count INTEGER;
  new_kyc_level INTEGER;
BEGIN
  -- Count approved documents
  SELECT COUNT(*) INTO approved_docs_count
  FROM public.kyc_documents
  WHERE tenant_id = NEW.tenant_id
  AND status = 'approved';

  -- Determine KYC level based on approved documents
  IF approved_docs_count >= 5 THEN
    new_kyc_level := 3; -- Full verification
  ELSIF approved_docs_count >= 3 THEN
    new_kyc_level := 2; -- Enhanced verification
  ELSIF approved_docs_count >= 1 THEN
    new_kyc_level := 1; -- Basic verification
  ELSE
    new_kyc_level := 0; -- Not verified
  END IF;

  -- Update tenant KYC level and status
  UPDATE public.tenants
  SET 
    kyc_level = new_kyc_level,
    kyc_status = CASE 
      WHEN new_kyc_level >= 2 THEN 'verified'
      WHEN new_kyc_level = 1 THEN 'pending'
      ELSE 'pending'
    END,
    kyc_verified_at = CASE 
      WHEN new_kyc_level >= 2 THEN now()
      ELSE kyc_verified_at
    END,
    kyc_verified_by = CASE 
      WHEN new_kyc_level >= 2 THEN NEW.verified_by
      ELSE kyc_verified_by
    END
  WHERE id = NEW.tenant_id;

  RETURN NEW;
END;
$$;