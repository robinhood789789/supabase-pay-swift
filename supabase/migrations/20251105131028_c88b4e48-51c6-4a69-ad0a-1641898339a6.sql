-- ฟังก์ชันช่วยอัปเดตยอด tenant_wallets ตามทิศทาง (IN/OUT)
CREATE OR REPLACE FUNCTION public.wallet_apply_delta(
  p_tenant_id UUID, 
  p_currency TEXT, 
  p_direction tx_direction, 
  p_amount NUMERIC
)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  -- สร้าง wallet ถ้าไม่มี (ใช้ tenant_id เป็นตัวระบุ)
  INSERT INTO public.tenant_wallets (id, tenant_id, currency, balance, created_at, updated_at)
  VALUES (gen_random_uuid(), p_tenant_id, COALESCE(p_currency, 'THB'), 0.00, now(), now())
  ON CONFLICT (tenant_id) DO NOTHING;

  -- อัปเดตยอดตามทิศทาง
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

-- ฟังก์ชันคืนยอด (ใช้ตอน roll-back หรือเปลี่ยนสถานะจาก SUCCESS กลับเป็นอื่น)
CREATE OR REPLACE FUNCTION public.wallet_reverse_delta(
  p_tenant_id UUID, 
  p_currency TEXT, 
  p_direction tx_direction, 
  p_amount NUMERIC
)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  -- สร้าง wallet ถ้าไม่มี
  INSERT INTO public.tenant_wallets (id, tenant_id, currency, balance, created_at, updated_at)
  VALUES (gen_random_uuid(), p_tenant_id, COALESCE(p_currency, 'THB'), 0.00, now(), now())
  ON CONFLICT (tenant_id) DO NOTHING;

  -- คืนยอดตามทิศทางเดิม (กลับกัน)
  IF p_direction = 'IN' THEN
    -- เดิม IN -> คืนยอดลบออก
    UPDATE public.tenant_wallets
    SET balance = balance - p_amount,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
  ELSIF p_direction = 'OUT' THEN
    -- เดิม OUT -> คืนยอดบวกกลับ
    UPDATE public.tenant_wallets
    SET balance = balance + p_amount,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
  END IF;
END;
$$;

-- ฟังก์ชัน Trigger: หลัง INSERT -> ถ้าสถานะ = SUCCESS ให้ตัดยอดทันที
CREATE OR REPLACE FUNCTION public.trg_tx_after_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'SUCCESS' THEN
    PERFORM public.wallet_apply_delta(NEW.tenant_id, NEW.currency, NEW.direction, NEW.net_amount);
  END IF;

  -- บันทึก audit log
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

-- ฟังก์ชัน Trigger: หลัง UPDATE -> handle เปลี่ยนสถานะ
CREATE OR REPLACE FUNCTION public.trg_tx_after_update()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- จากไม่ SUCCESS -> SUCCESS => ตัดยอด
  IF (OLD.status <> 'SUCCESS') AND (NEW.status = 'SUCCESS') THEN
    PERFORM public.wallet_apply_delta(NEW.tenant_id, NEW.currency, NEW.direction, NEW.net_amount);
    NEW.processed_at = now();
  END IF;

  -- จาก SUCCESS -> สถานะอื่น => คืนยอด
  IF (OLD.status = 'SUCCESS') AND (NEW.status <> 'SUCCESS') THEN
    PERFORM public.wallet_reverse_delta(OLD.tenant_id, OLD.currency, OLD.direction, OLD.net_amount);
  END IF;

  -- Audit log เมื่อเปลี่ยนสถานะ
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

-- สร้าง Triggers
DROP TRIGGER IF EXISTS after_insert_tx ON public.transactions;
CREATE TRIGGER after_insert_tx
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_tx_after_insert();

DROP TRIGGER IF EXISTS after_update_tx ON public.transactions;
CREATE TRIGGER after_update_tx
AFTER UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_tx_after_update();

-- Comment สำหรับอธิบาย
COMMENT ON FUNCTION public.wallet_apply_delta IS 'อัปเดตยอด tenant_wallets ตามทิศทาง IN=เพิ่ม, OUT=ลด';
COMMENT ON FUNCTION public.wallet_reverse_delta IS 'คืนยอด wallet เมื่อยกเลิกหรือ roll-back transaction';
COMMENT ON FUNCTION public.trg_tx_after_insert IS 'Trigger หลัง INSERT: ถ้า status=SUCCESS ให้ตัดยอดทันที + บันทึก audit';
COMMENT ON FUNCTION public.trg_tx_after_update IS 'Trigger หลัง UPDATE: handle การเปลี่ยนสถานะ SUCCESS <-> อื่นๆ';