-- Update commission_rate to 1.5% for existing shareholder clients
UPDATE shareholder_clients 
SET 
  commission_rate = 1.5,
  updated_at = now()
WHERE tenant_id IN (
  SELECT id FROM tenants WHERE public_id IN ('OWA-123456', 'PEA-122356')
);