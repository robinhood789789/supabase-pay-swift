-- Add status column to memberships table
ALTER TABLE public.memberships 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);

-- Add comment
COMMENT ON COLUMN public.memberships.status IS 'User membership status in tenant: active or inactive';