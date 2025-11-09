-- Add verification fields to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS verification_note TEXT,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_verified ON public.transactions(is_verified, verified_at);
CREATE INDEX IF NOT EXISTS idx_transactions_date_range ON public.transactions(tenant_id, created_at);

-- Create edge function to verify transaction
COMMENT ON COLUMN public.transactions.verified_at IS 'Timestamp when transaction was verified by viewer';
COMMENT ON COLUMN public.transactions.verified_by IS 'User ID of viewer who verified the transaction';
COMMENT ON COLUMN public.transactions.verification_note IS 'Note added by viewer during verification';
COMMENT ON COLUMN public.transactions.is_verified IS 'Whether transaction has been verified by a viewer';