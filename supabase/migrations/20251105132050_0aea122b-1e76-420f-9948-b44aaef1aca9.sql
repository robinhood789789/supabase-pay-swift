-- RLS Policies สำหรับ transactions table และ views
-- ออกแบบให้ปลอดภัยแต่ใช้งานได้จริง

-- เปิดใช้ RLS บน views (ถ้ายังไม่เปิด)
ALTER VIEW public.v_tx_daily_by_tenant SET (security_barrier = true);
ALTER VIEW public.v_tx_daily_by_shareholder SET (security_barrier = true);
ALTER VIEW public.v_tx_monthly_by_tenant SET (security_barrier = true);
ALTER VIEW public.v_tx_monthly_by_shareholder SET (security_barrier = true);

-- ===========================================
-- POLICIES FOR TRANSACTIONS TABLE
-- ===========================================

-- 1. Super admins สามารถทำทุกอย่างกับ transactions
DROP POLICY IF EXISTS "Super admins can view all transactions" ON public.transactions;
CREATE POLICY "Super admins can view all transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage all transactions" ON public.transactions;
CREATE POLICY "Super admins can manage all transactions"
ON public.transactions
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 2. Users สามารถดู transactions ใน tenant ของตัวเอง
DROP POLICY IF EXISTS "Users can view transactions in their tenant" ON public.transactions;
CREATE POLICY "Users can view transactions in their tenant"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships 
    WHERE user_id = auth.uid()
  )
);

-- 3. Shareholders สามารถดู transactions ที่เกี่ยวข้องกับตัวเอง
DROP POLICY IF EXISTS "Shareholders can view their transactions" ON public.transactions;
CREATE POLICY "Shareholders can view their transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  shareholder_id IN (
    SELECT id FROM public.shareholders 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 4. Owners และ Finance roles สามารถสร้าง transactions ใน tenant ของตัวเอง
DROP POLICY IF EXISTS "Authorized users can insert transactions" ON public.transactions;
CREATE POLICY "Authorized users can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  -- ต้องเป็น member ของ tenant นั้น
  tenant_id IN (
    SELECT m.tenant_id 
    FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'admin', 'manager', 'finance')
  )
  -- และ created_by_id ต้องเป็นตัวเอง
  AND created_by_id = auth.uid()
);

-- 5. Owners และ Finance roles สามารถอัปเดต transactions ใน tenant ของตัวเอง
DROP POLICY IF EXISTS "Authorized users can update transactions" ON public.transactions;
CREATE POLICY "Authorized users can update transactions"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT m.tenant_id 
    FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'admin', 'manager', 'finance')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT m.tenant_id 
    FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'admin', 'manager', 'finance')
  )
);

-- 6. Service role สามารถทำทุกอย่าง (สำหรับ Edge Functions)
DROP POLICY IF EXISTS "Service role can manage all transactions" ON public.transactions;
CREATE POLICY "Service role can manage all transactions"
ON public.transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ===========================================
-- GRANT PERMISSIONS FOR VIEWS
-- ===========================================

-- อนุญาตให้ authenticated users query views
GRANT SELECT ON public.v_tx_daily_by_tenant TO authenticated;
GRANT SELECT ON public.v_tx_daily_by_shareholder TO authenticated;
GRANT SELECT ON public.v_tx_monthly_by_tenant TO authenticated;
GRANT SELECT ON public.v_tx_monthly_by_shareholder TO authenticated;

GRANT SELECT ON public.v_tx_daily_by_tenant TO service_role;
GRANT SELECT ON public.v_tx_daily_by_shareholder TO service_role;
GRANT SELECT ON public.v_tx_monthly_by_tenant TO service_role;
GRANT SELECT ON public.v_tx_monthly_by_shareholder TO service_role;

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON POLICY "Super admins can view all transactions" ON public.transactions IS 
  'Super admins มีสิทธิ์ดูทุก transaction ในระบบ';

COMMENT ON POLICY "Users can view transactions in their tenant" ON public.transactions IS 
  'Users สามารถดู transactions ใน tenant ที่ตัวเองเป็นสมาชิก';

COMMENT ON POLICY "Shareholders can view their transactions" ON public.transactions IS 
  'Shareholders สามารถดู transactions ที่เกี่ยวข้องกับสายการขายของตัวเอง';

COMMENT ON POLICY "Authorized users can insert transactions" ON public.transactions IS 
  'Owner, Admin, Manager, Finance สามารถสร้าง transaction ใหม่ใน tenant ของตัวเอง';

COMMENT ON POLICY "Authorized users can update transactions" ON public.transactions IS 
  'Owner, Admin, Manager, Finance สามารถอัปเดต transaction status และข้อมูลอื่นๆ';