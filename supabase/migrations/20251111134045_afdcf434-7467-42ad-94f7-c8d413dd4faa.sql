-- Add status column to memberships table
ALTER TABLE public.memberships 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid status values
ALTER TABLE public.memberships 
ADD CONSTRAINT memberships_status_check 
CHECK (status IN ('active', 'inactive'));

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);