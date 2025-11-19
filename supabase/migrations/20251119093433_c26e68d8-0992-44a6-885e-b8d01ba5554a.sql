-- Add tenant_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- Add index for better query performance
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- Add comment to document the column
COMMENT ON COLUMN public.profiles.tenant_id IS 'Primary tenant ID for the user (nullable for users without tenants like super admins)';