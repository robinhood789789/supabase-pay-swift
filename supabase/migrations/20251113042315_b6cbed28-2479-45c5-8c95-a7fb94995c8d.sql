-- Create webhooks table with all fields
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  events JSONB DEFAULT '[]'::jsonb,
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0
);

-- Add foreign key after table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'webhooks_tenant_id_fkey' 
    AND table_name = 'webhooks'
  ) THEN
    ALTER TABLE public.webhooks 
    ADD CONSTRAINT webhooks_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_id ON public.webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON public.webhooks(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON public.webhooks USING gin(events);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_enabled ON public.webhooks(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON public.webhooks(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger
DROP TRIGGER IF EXISTS trigger_webhooks_updated_at ON public.webhooks;
CREATE TRIGGER trigger_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webhooks_updated_at();

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view webhooks in their tenant" ON public.webhooks;
DROP POLICY IF EXISTS "Users can insert webhooks in their tenant" ON public.webhooks;
DROP POLICY IF EXISTS "Users can update webhooks in their tenant" ON public.webhooks;
DROP POLICY IF EXISTS "Users can delete webhooks in their tenant" ON public.webhooks;
DROP POLICY IF EXISTS "Service role can manage webhooks" ON public.webhooks;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view webhooks in their tenant"
  ON public.webhooks
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert webhooks in their tenant"
  ON public.webhooks
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update webhooks in their tenant"
  ON public.webhooks
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete webhooks in their tenant"
  ON public.webhooks
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage webhooks"
  ON public.webhooks
  FOR ALL
  USING (
    (auth.jwt() ->> 'role'::text) = 'service_role'::text
  );