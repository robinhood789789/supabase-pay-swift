-- Seed Data: ข้อมูลตัวอย่างธุรกรรมเพื่อทดสอบระบบ (แก้ไข column names)
-- หมายเหตุ: ใช้ owner_user_id และ owner_tenant_id ตาม schema ที่มีอยู่

DO $$
DECLARE
  sample_tenant_id UUID;
  sample_owner1_id UUID;
  sample_owner2_id UUID;
  sample_shareholder_id UUID;
  sample_creator_id UUID;
BEGIN
  -- ดึง tenant แรกที่มีในระบบ (หรือสร้างใหม่ถ้าไม่มี)
  SELECT id INTO sample_tenant_id FROM public.tenants LIMIT 1;
  
  IF sample_tenant_id IS NULL THEN
    -- สร้าง tenant ตัวอย่าง
    INSERT INTO public.tenants (id, name, status, created_at)
    VALUES (gen_random_uuid(), 'Demo Tenant - Yu Express', 'active', now())
    RETURNING id INTO sample_tenant_id;
  END IF;

  -- ดึง shareholder แรก (หรือข้าม)
  SELECT id INTO sample_shareholder_id FROM public.shareholders LIMIT 1;

  -- ดึง profile 2 คนแรกเพื่อเป็น owner
  SELECT id INTO sample_owner1_id FROM public.profiles LIMIT 1;
  SELECT id INTO sample_owner2_id FROM public.profiles OFFSET 1 LIMIT 1;
  
  IF sample_owner2_id IS NULL THEN
    sample_owner2_id := sample_owner1_id;
  END IF;

  sample_creator_id := sample_owner1_id;

  -- สร้าง wallet สำหรับ tenant (ถ้ายังไม่มี)
  INSERT INTO public.tenant_wallets (id, tenant_id, currency, balance, created_at, updated_at)
  VALUES (gen_random_uuid(), sample_tenant_id, 'THB', 100000.00, now(), now())
  ON CONFLICT (tenant_id) DO NOTHING;

  -- ธุรกรรมตัวอย่าง: ใช้ owner_user_id และ owner_tenant_id
  INSERT INTO public.transactions (
    id, tenant_id, owner_user_id, owner_tenant_id, shareholder_id, 
    type, direction, status, method,
    amount, fee, net_amount, currency, reference, counterparty, note,
    created_at, processed_at, created_by_id
  ) VALUES
  -- DEPOSIT สำเร็จ (จะทำให้ wallet เพิ่ม)
  (
    gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
    'DEPOSIT', 'IN', 'SUCCESS', 'BANK',
    30000.00, 30.00, 29970.00, 'THB',
    'BKK-DEP-001', 'Bangkok Bank', 'Initial deposit via bank transfer',
    now() - interval '5 days', now() - interval '5 days', sample_creator_id
  ),
  (
    gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
    'DEPOSIT', 'IN', 'SUCCESS', 'QR',
    15000.00, 15.00, 14985.00, 'THB',
    'QR-PP-8821', 'PromptPay', 'QR PromptPay payment',
    now() - interval '3 days', now() - interval '3 days', sample_creator_id
  ),
  (
    gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
    'DEPOSIT', 'IN', 'SUCCESS', 'WECHAT',
    45000.00, 90.00, 44910.00, 'THB',
    'WX-20251101-001', 'WeChat Pay', 'CN -> TH top-up via WeChat',
    now() - interval '4 days', now() - interval '4 days', sample_creator_id
  ),
  -- DEPOSIT รอดำเนินการ
  (
    gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
    'DEPOSIT', 'IN', 'PENDING', 'QR',
    10000.00, 10.00, 9990.00, 'THB',
    'QR-PEND-991', 'PromptPay', 'Awaiting confirmation',
    now() - interval '2 hours', NULL, sample_creator_id
  ),
  -- DEPOSIT ล้มเหลว
  (
    gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
    'DEPOSIT', 'IN', 'FAILED', 'ALIPAY',
    12000.00, 24.00, 11976.00, 'THB',
    'ALI-ERR-77', 'Alipay', 'Risk check failed - rejected by provider',
    now() - interval '6 days', now() - interval '6 days', sample_creator_id
  ),
  
  -- WITHDRAWAL (เงินออก)
  (
    gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
    'WITHDRAWAL', 'OUT', 'SUCCESS', 'BANK',
    5000.00, 15.00, 4985.00, 'THB',
    'BKK-WD-2201', 'KBank', 'Payout cycle #1 to merchant',
    now() - interval '2 days', now() - interval '2 days', sample_creator_id
  ),
  (
    gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
    'WITHDRAWAL', 'OUT', 'PROCESSING', 'BANK',
    10000.00, 20.00, 9980.00, 'THB',
    'BKK-WD-3301', 'Bangkok Bank', 'Processing - cutoff 17:00',
    now() - interval '6 hours', NULL, sample_creator_id
  ),
  (
    gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
    'WITHDRAWAL', 'OUT', 'FAILED', 'BANK',
    7000.00, 15.00, 6985.00, 'THB',
    'BKK-WD-FAIL', 'SCB', 'Account name mismatch - rejected',
    now() - interval '1 day', now() - interval '1 day', sample_creator_id
  );

  -- TRANSFER (โอนระหว่าง owner) - เฉพาะเมื่อมี owner 2 คนขึ้นไป
  IF sample_owner1_id IS DISTINCT FROM sample_owner2_id THEN
    INSERT INTO public.transactions (
      id, tenant_id, owner_user_id, owner_tenant_id, shareholder_id, 
      type, direction, status, method,
      amount, fee, net_amount, currency, reference, counterparty, note,
      created_at, processed_at, created_by_id, metadata
    ) VALUES
    -- OUT จากผู้โอน
    (
      gen_random_uuid(), sample_tenant_id, sample_owner1_id, sample_tenant_id, sample_shareholder_id,
      'TRANSFER', 'OUT', 'SUCCESS', 'CASH',
      2000.00, 0.00, 2000.00, 'THB',
      'INT-TR-001', 'Internal Transfer', 'Transfer to second owner',
      now() - interval '12 hours', now() - interval '12 hours', sample_creator_id,
      jsonb_build_object('to_owner_id', sample_owner2_id)
    ),
    -- IN ไปผู้รับ
    (
      gen_random_uuid(), sample_tenant_id, sample_owner2_id, sample_tenant_id, sample_shareholder_id,
      'TRANSFER', 'IN', 'SUCCESS', 'CASH',
      2000.00, 0.00, 2000.00, 'THB',
      'INT-TR-001', 'Internal Transfer', 'Received from first owner',
      now() - interval '12 hours', now() - interval '12 hours', sample_creator_id,
      jsonb_build_object('from_owner_id', sample_owner1_id)
    );
  END IF;

  -- บันทึก audit log
  INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, target, after, created_at)
  VALUES (
    sample_tenant_id,
    sample_creator_id,
    'SEED_DATA_CREATED',
    'transactions',
    jsonb_build_object(
      'message', 'Sample transactions created for testing',
      'count', 10,
      'types', ARRAY['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']
    ),
    now()
  );

  RAISE NOTICE 'Seed data created successfully for tenant: %', sample_tenant_id;
  RAISE NOTICE 'Total transactions: 8 base + 2 transfer (if multiple owners exist)';
  RAISE NOTICE 'Wallet balance will be updated automatically via triggers';
END $$;