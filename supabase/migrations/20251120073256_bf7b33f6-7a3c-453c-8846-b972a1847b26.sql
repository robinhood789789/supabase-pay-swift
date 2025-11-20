-- Add mfa_last_verified_at column to profiles table for step-up MFA tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mfa_last_verified_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.mfa_last_verified_at IS 'Timestamp of last successful MFA verification, used for step-up authentication window';