-- อัพเดท deposit_transfers ที่มีอยู่ให้มี tenant_id ของ OWA (tenant_id: 7b63509c-55a6-47be-b1c2-e24fd5f19b85)
UPDATE public.deposit_transfers
SET tenant_id = '7b63509c-55a6-47be-b1c2-e24fd5f19b85'
WHERE id IN (1, 2, 3, 4, 5);

-- เพิ่มข้อมูล deposit_transfers ใหม่สำหรับ tenant OWA เพื่อการทดสอบ
INSERT INTO public.deposit_transfers (
  ref_id,
  tenant_id,
  custaccountname,
  custaccountnumber,
  fullname,
  amountpaid,
  status,
  depositdate,
  adminbank_bankname,
  bankcode,
  created_at
) VALUES 
  ('DEP-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 6, '0'), '7b63509c-55a6-47be-b1c2-e24fd5f19b85', 'คุณสมชาย', '1234567890', 'สมชาย ใจดี', 5000.00, 'completed', NOW(), 'ธนาคารกรุงเทพ', 'BBL', NOW()),
  ('DEP-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 6, '0'), '7b63509c-55a6-47be-b1c2-e24fd5f19b85', 'คุณสมศรี', '0987654321', 'สมศรี มีสุข', 3000.00, 'pending', NOW() - INTERVAL '1 hour', 'ธนาคารไทยพาณิชย์', 'SCB', NOW() - INTERVAL '1 hour'),
  ('DEP-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 6, '0'), '7b63509c-55a6-47be-b1c2-e24fd5f19b85', 'คุณสมหมาย', '5555666677', 'สมหมาย รวยมาก', 10000.00, 'completed', NOW() - INTERVAL '2 hours', 'ธนาคารกสิกรไทย', 'KBANK', NOW() - INTERVAL '2 hours'),
  ('DEP-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 6, '0'), '7b63509c-55a6-47be-b1c2-e24fd5f19b85', 'คุณจินตนา', '7777888899', 'จินตนา มั่งมี', 7500.00, 'completed', NOW() - INTERVAL '3 hours', 'ธนาคารกรุงศรี', 'BAY', NOW() - INTERVAL '3 hours'),
  ('DEP-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 6, '0'), '7b63509c-55a6-47be-b1c2-e24fd5f19b85', 'คุณประสิทธิ์', '2222333344', 'ประสิทธิ์ เจริญ', 2500.00, 'rejected', NOW() - INTERVAL '4 hours', 'ธนาคารทหารไทย', 'TMB', NOW() - INTERVAL '4 hours');