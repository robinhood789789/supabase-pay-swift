-- Create all required database functions

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = user_uuid),
    false
  );
$$;

-- Check if user is shareholder
CREATE OR REPLACE FUNCTION public.is_shareholder(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shareholders
    WHERE user_id = user_uuid AND status = 'active'
  );
$$;

-- Get shareholder ID
CREATE OR REPLACE FUNCTION public.get_shareholder_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT id FROM public.shareholders
  WHERE user_id = user_uuid AND status = 'active'
  LIMIT 1;
$$;

-- Get user's tenant ID
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT tenant_id FROM public.memberships WHERE user_id = user_uuid LIMIT 1;
$$;

-- Check if user has specific role in tenant
CREATE OR REPLACE FUNCTION public.user_has_role_in_tenant(user_uuid uuid, role_name text, tenant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

-- Check if user is member of tenant
CREATE OR REPLACE FUNCTION public.is_member_of_tenant(tenant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = auth.uid()
    AND tenant_id = tenant_uuid
  );
$$;

-- Get tenant from request header
CREATE OR REPLACE FUNCTION public.request_tenant()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json->>'x-tenant', '')::uuid;
$$;

-- Generate public ID with prefix
CREATE OR REPLACE FUNCTION public.generate_public_id(prefix_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  next_value INTEGER;
  new_public_id TEXT;
BEGIN
  UPDATE public.id_sequences
  SET 
    current_value = current_value + 1,
    updated_at = now()
  WHERE prefix = prefix_code
  RETURNING current_value INTO next_value;
  
  IF next_value IS NULL THEN
    RAISE EXCEPTION 'Sequence prefix % not found', prefix_code;
  END IF;
  
  new_public_id := prefix_code || '-' || LPAD(next_value::TEXT, 6, '0');
  
  RETURN new_public_id;
END;
$$;

-- Apply wallet delta (increase/decrease balance)
CREATE OR REPLACE FUNCTION public.wallet_apply_delta(p_tenant_id uuid, p_currency text, p_direction tx_direction, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.tenant_wallets (id, tenant_id, currency, balance, created_at, updated_at)
  VALUES (gen_random_uuid(), p_tenant_id, COALESCE(p_currency, 'THB'), 0.00, now(), now())
  ON CONFLICT (tenant_id) DO NOTHING;

  IF p_direction = 'IN' THEN
    UPDATE public.tenant_wallets
    SET balance = balance + p_amount,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
  ELSIF p_direction = 'OUT' THEN
    UPDATE public.tenant_wallets
    SET balance = balance - p_amount,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
  END IF;
END;
$$;

-- Reverse wallet delta
CREATE OR REPLACE FUNCTION public.wallet_reverse_delta(p_tenant_id uuid, p_currency text, p_direction tx_direction, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.tenant_wallets (id, tenant_id, currency, balance, created_at, updated_at)
  VALUES (gen_random_uuid(), p_tenant_id, COALESCE(p_currency, 'THB'), 0.00, now(), now())
  ON CONFLICT (tenant_id) DO NOTHING;

  IF p_direction = 'IN' THEN
    UPDATE public.tenant_wallets
    SET balance = balance - p_amount,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
  ELSIF p_direction = 'OUT' THEN
    UPDATE public.tenant_wallets
    SET balance = balance + p_amount,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
  END IF;
END;
$$;

-- Update tenant KYC status based on documents
CREATE OR REPLACE FUNCTION public.update_tenant_kyc_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  approved_docs_count INTEGER;
  new_kyc_level INTEGER;
BEGIN
  SELECT COUNT(*) INTO approved_docs_count
  FROM public.kyc_documents
  WHERE tenant_id = NEW.tenant_id
  AND status = 'approved';

  IF approved_docs_count >= 5 THEN
    new_kyc_level := 3;
  ELSIF approved_docs_count >= 3 THEN
    new_kyc_level := 2;
  ELSIF approved_docs_count >= 1 THEN
    new_kyc_level := 1;
  ELSE
    new_kyc_level := 0;
  END IF;

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

-- Generate referral code for shareholders
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'SH' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM shareholders WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Assign referral code on shareholder insert
CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Track referral when tenant is created
CREATE OR REPLACE FUNCTION public.track_referral_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  shareholder_record RECORD;
BEGIN
  IF NEW.referred_by_code IS NOT NULL THEN
    SELECT * INTO shareholder_record
    FROM public.shareholders
    WHERE referral_code = NEW.referred_by_code
    AND status = 'active';
    
    IF FOUND THEN
      NEW.referred_by_shareholder_id := shareholder_record.id;
      NEW.referral_accepted_at := now();
      
      INSERT INTO public.shareholder_clients (
        shareholder_id,
        tenant_id,
        commission_rate,
        status,
        referral_source
      ) VALUES (
        shareholder_record.id,
        NEW.id,
        5.0,
        'active',
        'referral_code'
      );
      
      UPDATE public.shareholders
      SET referral_count = referral_count + 1
      WHERE id = shareholder_record.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Transaction after insert trigger function
CREATE OR REPLACE FUNCTION public.trg_tx_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'SUCCESS' THEN
    PERFORM public.wallet_apply_delta(NEW.tenant_id, NEW.currency, NEW.direction, NEW.net_amount);
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, target, after, created_at)
  VALUES (
    NEW.tenant_id, 
    NEW.created_by_id, 
    'TX_CREATE', 
    'transactions:' || NEW.id::text,
    jsonb_build_object(
      'type', NEW.type, 
      'status', NEW.status, 
      'amount', NEW.amount, 
      'net_amount', NEW.net_amount,
      'direction', NEW.direction,
      'method', NEW.method
    ),
    now()
  );

  RETURN NEW;
END;
$$;

-- Transaction after update trigger function
CREATE OR REPLACE FUNCTION public.trg_tx_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (OLD.status <> 'SUCCESS') AND (NEW.status = 'SUCCESS') THEN
    PERFORM public.wallet_apply_delta(NEW.tenant_id, NEW.currency, NEW.direction, NEW.net_amount);
    NEW.processed_at = now();
  END IF;

  IF (OLD.status = 'SUCCESS') AND (NEW.status <> 'SUCCESS') THEN
    PERFORM public.wallet_reverse_delta(OLD.tenant_id, OLD.currency, OLD.direction, OLD.net_amount);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, target, before, after, created_at)
    VALUES (
      NEW.tenant_id,
      NEW.created_by_id,
      'TX_STATUS_UPDATE',
      'transactions:' || NEW.id::text,
      jsonb_build_object('status', OLD.status, 'processed_at', OLD.processed_at),
      jsonb_build_object('status', NEW.status, 'processed_at', NEW.processed_at),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Audit security changes
CREATE OR REPLACE FUNCTION public.audit_security_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  user_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO user_tenant_id
  FROM public.memberships
  WHERE user_id = COALESCE(NEW.id, OLD.id)
  LIMIT 1;
  
  IF user_tenant_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      tenant_id, actor_user_id, action, target, before, after, ip, user_agent
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

-- Validate API key access
CREATE OR REPLACE FUNCTION public.validate_api_key_access(_prefix text, _endpoint text, _ip inet)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  key_record RECORD;
BEGIN
  SELECT * INTO key_record
  FROM public.api_keys
  WHERE prefix = _prefix
    AND status = 'active'
    AND is_active = true
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  END IF;
  
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE id = key_record.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'tenant_id', key_record.tenant_id,
    'key_type', key_record.key_type,
    'scope', key_record.scope
  );
END;
$$;

-- Cleanup replay cache
CREATE OR REPLACE FUNCTION public.cleanup_replay_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  DELETE FROM public.hmac_replay_cache
  WHERE created_at < now() - interval '10 minutes';
END;
$$;

-- Cleanup expired temporary codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.temporary_codes
  SET is_active = false, updated_at = now()
  WHERE is_active = true AND expires_at < now();
END;
$$;