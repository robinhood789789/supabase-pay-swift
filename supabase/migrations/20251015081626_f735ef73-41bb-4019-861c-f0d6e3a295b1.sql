-- Update tenant_id of existing payments to match user's workspace
UPDATE public.payments 
SET tenant_id = '882034d2-c615-4540-b93c-ea00b6965bc8' 
WHERE tenant_id = '6d7d92ba-bc0c-491e-8419-1c349965063b';