-- ====================================
-- 001_transactions_init.sql
-- สร้างระบบธุรกรรมเงินให้เข้ากับโครงสร้างปัจจุบัน
-- ====================================

-- 1. สร้าง Enums สำหรับประเภทธุรกรรม
DO $$ BEGIN
  CREATE TYPE tx_type AS ENUM ('DEPOSIT','WITHDRAWAL','TRANSFER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE tx_status AS ENUM ('PENDING','PROCESSING','SUCCESS','FAILED','CANCELED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('BANK','QR','WECHAT','ALIPAY','CASH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE tx_direction AS ENUM ('IN','OUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. ปรับ tenant_wallets ให้มี currency (ถ้ายังไม่มี)
ALTER TABLE tenant_wallets 
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'THB';

-- 3. สร้างตาราง transactions หลัก
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- เจ้าของธุรกรรม (อาจเป็น user หรือ tenant ขึ้นอยู่กับบริบท)
  owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  owner_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- สำหรับระบบ shareholder (ถ้ามี)
  shareholder_id UUID REFERENCES shareholders(id) ON DELETE SET NULL,
  
  -- ข้อมูลธุรกรรม
  type tx_type NOT NULL,
  direction tx_direction NOT NULL,
  status tx_status NOT NULL DEFAULT 'PENDING',
  method payment_method NOT NULL,
  
  -- จำนวนเงิน
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (fee >= 0),
  net_amount NUMERIC(18,2) NOT NULL CHECK (net_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'THB',
  
  -- ข้อมูลเพิ่มเติม
  reference TEXT,
  counterparty TEXT,
  note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- เวลา
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- ผู้สร้างธุรกรรม
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 4. สร้าง Indexes สำหรับประสิทธิภาพ
CREATE INDEX IF NOT EXISTS idx_tx_tenant ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tx_owner_user ON transactions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tx_owner_tenant ON transactions(owner_tenant_id);
CREATE INDEX IF NOT EXISTS idx_tx_shareholder ON transactions(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_tx_type_status ON transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_tx_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_tx_success_date ON transactions(created_at) WHERE status = 'SUCCESS';
CREATE INDEX IF NOT EXISTS idx_tx_reference ON transactions(reference) WHERE reference IS NOT NULL;

-- 5. Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 6. สร้างนโยบาย RLS พื้นฐาน
-- Super admin ดูทุกอย่างได้
CREATE POLICY "Super admins can view all transactions"
ON transactions FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- User ดูธุรกรรมใน tenant ตัวเองได้
CREATE POLICY "Users can view their tenant transactions"
ON transactions FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
  )
);

-- Shareholder ดูธุรกรรมที่เกี่ยวข้องกับตัวเองได้
CREATE POLICY "Shareholders can view their transactions"
ON transactions FOR SELECT
TO authenticated
USING (
  shareholder_id IN (
    SELECT id FROM shareholders WHERE user_id = auth.uid()
  )
);

COMMENT ON TABLE transactions IS 'ตารางบันทึกธุรกรรมทางการเงินทั้งหมด รองรับ DEPOSIT, WITHDRAWAL, TRANSFER พร้อม direction (IN/OUT) เพื่อจัดการยอด wallet อัตโนมัติ';