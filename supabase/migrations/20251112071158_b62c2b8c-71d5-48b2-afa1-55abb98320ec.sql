-- Remove user_password and add public_id and password
ALTER TABLE public.customer_bank_accounts
DROP COLUMN IF EXISTS user_password,
ADD COLUMN IF NOT EXISTS public_id TEXT,
ADD COLUMN IF NOT EXISTS password TEXT;