-- Add user_id column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS user_id text UNIQUE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON public.tenants(user_id);

-- Add comment
COMMENT ON COLUMN public.tenants.user_id IS 'Unique 6-digit user identifier for the tenant owner';