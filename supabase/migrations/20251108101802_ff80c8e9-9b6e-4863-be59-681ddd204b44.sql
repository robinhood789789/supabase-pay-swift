-- Add public_id column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN public_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_tenants_public_id ON public.tenants(public_id);

-- Update existing tenants to have public_ids (if any exist)
DO $$
DECLARE
  tenant_record RECORD;
  new_public_id TEXT;
BEGIN
  FOR tenant_record IN SELECT id FROM public.tenants WHERE public_id IS NULL LOOP
    new_public_id := public.generate_public_id('TNT');
    UPDATE public.tenants SET public_id = new_public_id WHERE id = tenant_record.id;
  END LOOP;
END $$;

-- Make public_id NOT NULL after populating existing records
ALTER TABLE public.tenants 
ALTER COLUMN public_id SET NOT NULL;