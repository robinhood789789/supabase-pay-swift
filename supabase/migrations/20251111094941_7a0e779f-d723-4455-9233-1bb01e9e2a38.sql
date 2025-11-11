-- Fix Security Warnings: Recreate views without SECURITY DEFINER
-- Drop และสร้าง views ใหม่โดยไม่ใช้ security_barrier

-- Drop existing views
DROP VIEW IF EXISTS public.v_tx_daily_by_tenant CASCADE;
DROP VIEW IF EXISTS public.v_tx_daily_by_shareholder CASCADE;
DROP VIEW IF EXISTS public.v_tx_monthly_by_tenant CASCADE;
DROP VIEW IF EXISTS public.v_tx_monthly_by_shareholder CASCADE;

-- Recreate views without security_barrier
-- View: สรุปยอดรายวันต่อ Tenant
CREATE VIEW public.v_tx_daily_by_tenant 
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  DATE(created_at) AS tx_date,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'IN'  THEN net_amount ELSE 0 END) AS net_in,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'OUT' THEN net_amount ELSE 0 END) AS net_out,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'DEPOSIT'    THEN net_amount ELSE 0 END) AS deposit_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) AS withdrawal_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'TRANSFER'   THEN net_amount ELSE 0 END) AS transfer_net,
  COUNT(*) AS tx_count,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) AS success_count,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_count
FROM public.transactions
GROUP BY tenant_id, DATE(created_at);

-- View: สรุปยอดรายวันต่อ Shareholder
CREATE VIEW public.v_tx_daily_by_shareholder
WITH (security_invoker = true)
AS
SELECT
  shareholder_id,
  DATE(created_at) AS tx_date,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'IN'  THEN net_amount ELSE 0 END) AS net_in,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'OUT' THEN net_amount ELSE 0 END) AS net_out,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'DEPOSIT'    THEN net_amount ELSE 0 END) AS deposit_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) AS withdrawal_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'TRANSFER'   THEN net_amount ELSE 0 END) AS transfer_net,
  COUNT(*) AS tx_count,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) AS success_count,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_count
FROM public.transactions
WHERE shareholder_id IS NOT NULL
GROUP BY shareholder_id, DATE(created_at);

-- View: สรุปยอดรายเดือนต่อ Tenant
CREATE VIEW public.v_tx_monthly_by_tenant
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at) AS tx_month,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'IN'  THEN net_amount ELSE 0 END) AS net_in,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'OUT' THEN net_amount ELSE 0 END) AS net_out,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'DEPOSIT'    THEN net_amount ELSE 0 END) AS deposit_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) AS withdrawal_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'TRANSFER'   THEN net_amount ELSE 0 END) AS transfer_net,
  SUM(CASE WHEN status = 'SUCCESS' THEN fee ELSE 0 END) AS total_fees,
  COUNT(*) AS tx_count,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) AS success_count
FROM public.transactions
GROUP BY tenant_id, DATE_TRUNC('month', created_at);

-- View: สรุปยอดรายเดือนต่อ Shareholder
CREATE VIEW public.v_tx_monthly_by_shareholder
WITH (security_invoker = true)
AS
SELECT
  shareholder_id,
  DATE_TRUNC('month', created_at) AS tx_month,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'IN'  THEN net_amount ELSE 0 END) AS net_in,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'OUT' THEN net_amount ELSE 0 END) AS net_out,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'DEPOSIT'    THEN net_amount ELSE 0 END) AS deposit_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) AS withdrawal_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'TRANSFER'   THEN net_amount ELSE 0 END) AS transfer_net,
  SUM(CASE WHEN status = 'SUCCESS' THEN fee ELSE 0 END) AS total_fees,
  COUNT(*) AS tx_count,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) AS success_count
FROM public.transactions
WHERE shareholder_id IS NOT NULL
GROUP BY shareholder_id, DATE_TRUNC('month', created_at);

-- Grant permissions
GRANT SELECT ON public.v_tx_daily_by_tenant TO authenticated;
GRANT SELECT ON public.v_tx_daily_by_shareholder TO authenticated;
GRANT SELECT ON public.v_tx_monthly_by_tenant TO authenticated;
GRANT SELECT ON public.v_tx_monthly_by_shareholder TO authenticated;

GRANT SELECT ON public.v_tx_daily_by_tenant TO service_role;
GRANT SELECT ON public.v_tx_daily_by_shareholder TO service_role;
GRANT SELECT ON public.v_tx_monthly_by_tenant TO service_role;
GRANT SELECT ON public.v_tx_monthly_by_shareholder TO service_role;

-- Add comments
COMMENT ON VIEW public.v_tx_daily_by_tenant IS 'สรุปยอดธุรกรรมรายวันของแต่ละ Tenant (SECURITY INVOKER - ใช้ RLS policies จาก transactions)';
COMMENT ON VIEW public.v_tx_daily_by_shareholder IS 'สรุปยอดธุรกรรมรายวันของแต่ละ Shareholder (SECURITY INVOKER - ใช้ RLS policies จาก transactions)';
COMMENT ON VIEW public.v_tx_monthly_by_tenant IS 'สรุปยอดธุรกรรมรายเดือนของแต่ละ Tenant (SECURITY INVOKER - ใช้ RLS policies จาก transactions)';
COMMENT ON VIEW public.v_tx_monthly_by_shareholder IS 'สรุปยอดธุรกรรมรายเดือนของแต่ละ Shareholder (SECURITY INVOKER - ใช้ RLS policies จาก transactions)';
