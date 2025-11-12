-- Add user_password and company_code to customer_bank_accounts
ALTER TABLE public.customer_bank_accounts
ADD COLUMN IF NOT EXISTS user_password TEXT,
ADD COLUMN IF NOT EXISTS company_code TEXT;