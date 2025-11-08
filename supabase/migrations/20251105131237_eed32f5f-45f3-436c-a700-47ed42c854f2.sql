-- View: สรุปยอดรายวันต่อ Tenant
CREATE OR REPLACE VIEW public.v_tx_daily_by_tenant AS
SELECT
  tenant_id,
  DATE(created_at) AS tx_date,
  -- ยอดรวมตามทิศทาง
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'IN'  THEN net_amount ELSE 0 END) AS net_in,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'OUT' THEN net_amount ELSE 0 END) AS net_out,
  -- ยอดรวมตามประเภทธุรกรรม
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'DEPOSIT'    THEN net_amount ELSE 0 END) AS deposit_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) AS withdrawal_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'TRANSFER'   THEN net_amount ELSE 0 END) AS transfer_net,
  -- จำนวนธุรกรรม
  COUNT(*) AS tx_count,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) AS success_count,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_count
FROM public.transactions
GROUP BY tenant_id, DATE(created_at);

-- View: สรุปยอดรายวันต่อ Shareholder (สายการขาย)
CREATE OR REPLACE VIEW public.v_tx_daily_by_shareholder AS
SELECT
  shareholder_id,
  DATE(created_at) AS tx_date,
  -- ยอดรวมตามทิศทาง
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'IN'  THEN net_amount ELSE 0 END) AS net_in,
  SUM(CASE WHEN status = 'SUCCESS' AND direction = 'OUT' THEN net_amount ELSE 0 END) AS net_out,
  -- ยอดรวมตามประเภทธุรกรรม
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'DEPOSIT'    THEN net_amount ELSE 0 END) AS deposit_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) AS withdrawal_net,
  SUM(CASE WHEN status = 'SUCCESS' AND type = 'TRANSFER'   THEN net_amount ELSE 0 END) AS transfer_net,
  -- จำนวนธุรกรรม
  COUNT(*) AS tx_count,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) AS success_count,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_count
FROM public.transactions
WHERE shareholder_id IS NOT NULL
GROUP BY shareholder_id, DATE(created_at);

-- View: สรุปยอดรายเดือนต่อ Tenant
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

-- View: สรุปยอดรายเดือนต่อ Shareholder
CREATE OR REPLACE VIEW public.v_tx_monthly_by_shareholder AS
SELECT
  shareholder_id,
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
WHERE shareholder_id IS NOT NULL
GROUP BY shareholder_id, DATE_TRUNC('month', created_at);

-- Comment อธิบาย
COMMENT ON VIEW public.v_tx_daily_by_tenant IS 'สรุปยอดธุรกรรมรายวันของแต่ละ Tenant: net_in/out, deposit/withdrawal/transfer, จำนวนธุรกรรม';
COMMENT ON VIEW public.v_tx_daily_by_shareholder IS 'สรุปยอดธุรกรรมรายวันของแต่ละ Shareholder (สายการขาย)';
COMMENT ON VIEW public.v_tx_monthly_by_tenant IS 'สรุปยอดธุรกรรมรายเดือนของแต่ละ Tenant';
COMMENT ON VIEW public.v_tx_monthly_by_shareholder IS 'สรุปยอดธุรกรรมรายเดือนของแต่ละ Shareholder';