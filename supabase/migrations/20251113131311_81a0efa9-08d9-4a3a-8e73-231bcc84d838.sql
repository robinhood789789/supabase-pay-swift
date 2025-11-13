-- Create table for saved transaction filters
CREATE TABLE IF NOT EXISTS public.transaction_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT transaction_filters_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transaction_filters_user_tenant 
  ON public.transaction_filters(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_transaction_filters_tenant 
  ON public.transaction_filters(tenant_id);

-- Enable Row Level Security
ALTER TABLE public.transaction_filters ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own filters for their tenant
CREATE POLICY "Users can view own transaction filters"
  ON public.transaction_filters
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own filters
CREATE POLICY "Users can create own transaction filters"
  ON public.transaction_filters
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own filters
CREATE POLICY "Users can update own transaction filters"
  ON public.transaction_filters
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own filters
CREATE POLICY "Users can delete own transaction filters"
  ON public.transaction_filters
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_transaction_filters_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_transaction_filters_timestamp
  BEFORE UPDATE ON public.transaction_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transaction_filters_updated_at();

-- Function to ensure only one default filter per user per tenant
CREATE OR REPLACE FUNCTION public.ensure_single_default_filter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If setting a filter as default, unset all other defaults for this user/tenant
  IF NEW.is_default = true THEN
    UPDATE public.transaction_filters
    SET is_default = false
    WHERE user_id = NEW.user_id 
      AND tenant_id = NEW.tenant_id 
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to ensure only one default filter
CREATE TRIGGER ensure_single_default_filter_trigger
  BEFORE INSERT OR UPDATE ON public.transaction_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_filter();