-- Add payment percentage columns to tenant_settings table
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS payment_deposit_percentage NUMERIC(5,2) DEFAULT 0 CHECK (payment_deposit_percentage >= 0 AND payment_deposit_percentage <= 100),
ADD COLUMN IF NOT EXISTS payment_withdrawal_percentage NUMERIC(5,2) DEFAULT 0 CHECK (payment_withdrawal_percentage >= 0 AND payment_withdrawal_percentage <= 100);