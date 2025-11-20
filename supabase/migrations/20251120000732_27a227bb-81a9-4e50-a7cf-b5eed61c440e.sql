-- Update public_id for tenant องค์กร 1 from TNT-000004 to OWA-123456
UPDATE tenants 
SET public_id = 'OWA-123456'
WHERE id = '7b63509c-55a6-47be-b1c2-e24fd5f19b85';

-- Update public_id for tenant องค์กร 2 from TNT-000005 to PEA-122356
UPDATE tenants 
SET public_id = 'PEA-122356'
WHERE id = '18afde70-3f5b-4f97-9770-6d36730343ca';