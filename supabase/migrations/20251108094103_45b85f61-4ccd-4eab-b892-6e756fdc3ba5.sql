-- Create all required database functions

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

-- Apply wallet delta
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