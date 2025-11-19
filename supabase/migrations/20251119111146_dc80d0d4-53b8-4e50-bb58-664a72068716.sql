
-- Link "Test Company Ltd." to the active shareholder
-- This allows the shareholder to manage and delete this tenant
INSERT INTO shareholder_clients (
  shareholder_id,
  tenant_id,
  commission_rate,
  status,
  referred_at
)
VALUES (
  '7b4beeb0-2d61-4e99-8b45-73091aa8b7c9',
  'bbc3573c-e402-43d0-a44d-ad0d79af009b',
  0.05, -- 5% default commission
  'active',
  NOW()
)
ON CONFLICT DO NOTHING;
