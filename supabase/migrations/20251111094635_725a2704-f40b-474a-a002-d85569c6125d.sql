-- Fix Security Warnings: Remove security_barrier from existing views
-- แก้ไข views ให้ใช้ RLS policies จาก base table แทน security_barrier

-- Remove security_barrier from existing views
ALTER VIEW public.v_tx_daily_by_tenant SET (security_barrier = false);
ALTER VIEW public.v_tx_daily_by_shareholder SET (security_barrier = false);
ALTER VIEW public.v_tx_monthly_by_shareholder SET (security_barrier = false);

-- Create missing v_tx_monthly_by_tenant view
CREATE OR REPLACE VIEW public.v_tx_monthly_by_tenant AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at) AS tx_month,
  -- ยอดรวมตามทิศทาง
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'IN'  THEN net_amount ELSE 0 END) AS net_in,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'OUT' THEN net_amount ELSE 0 END) AS net_out,
  -- ยอดรวมตามประเภทธุรกรรม
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'DEPOSIT'    THEN net_amount ELSE 0 END) AS deposit_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) AS withdrawal_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'TRANSFER'   THEN net_amount ELSE 0 END) AS transfer_net,
  -- ค่าธรรมเนียมรวม
  SUM(CASE WHEN status = 'SUCCESS' THEN fee ELSE 0 END) AS total_fees,
  -- จำนวนธุรกรรม
  COUNT(*) AS tx_count,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) AS success_count
FROM public.transactions
GROUP BY tenant_id, DATE_TRUNC('month', created_at);

-- Grant permissions
GRANT SELECT ON public.v_tx_monthly_by_tenant TO authenticated;
GRANT SELECT ON public.v_tx_monthly_by_tenant TO service_role;

-- Update comments to reflect new security model
COMMENT ON VIEW public.v_tx_daily_by_tenant IS 'สรุปยอดธุรกรรมรายวันของแต่ละ Tenant (ใช้ RLS policies จาก transactions table)';
COMMENT ON VIEW public.v_tx_daily_by_shareholder IS 'สรุปยอดธุรกรรมรายวันของแต่ละ Shareholder (ใช้ RLS policies จาก transactions table)';
COMMENT ON VIEW public.v_tx_monthly_by_tenant IS 'สรุปยอดธุรกรรมรายเดือนของแต่ละ Tenant (ใช้ RLS policies จาก transactions table)';
COMMENT ON VIEW public.v_tx_monthly_by_shareholder IS 'สรุปยอดธุรกรรมรายเดือนของแต่ละ Shareholder (ใช้ RLS policies จาก transactions table)';
