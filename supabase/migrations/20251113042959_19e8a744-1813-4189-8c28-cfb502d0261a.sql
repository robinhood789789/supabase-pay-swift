-- Create webhook_events table if not exists
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns if they don't exist
DO $$ 
BEGIN
  -- webhook_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'webhook_id') THEN
    ALTER TABLE public.webhook_events ADD COLUMN webhook_id UUID NOT NULL;
  END IF;
  
  -- tenant_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.webhook_events ADD COLUMN tenant_id UUID NOT NULL;
  END IF;
  
  -- event_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'event_type') THEN
    ALTER TABLE public.webhook_events ADD COLUMN event_type TEXT NOT NULL;
  END IF;
  
  -- payload column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'payload') THEN
    ALTER TABLE public.webhook_events ADD COLUMN payload JSONB NOT NULL;
  END IF;
  
  -- response_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'response_status') THEN
    ALTER TABLE public.webhook_events ADD COLUMN response_status INTEGER;
  END IF;
  
  -- response_body column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'response_body') THEN
    ALTER TABLE public.webhook_events ADD COLUMN response_body TEXT;
  END IF;
  
  -- error_message column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'error_message') THEN
    ALTER TABLE public.webhook_events ADD COLUMN error_message TEXT;
  END IF;
  
  -- delivered_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'delivered_at') THEN
    ALTER TABLE public.webhook_events ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- retry_count column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'retry_count') THEN
    ALTER TABLE public.webhook_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  -- success column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'webhook_events' AND column_name = 'success') THEN
    ALTER TABLE public.webhook_events ADD COLUMN success BOOLEAN;
  END IF;
END $$;

-- Add foreign keys only after columns exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'webhook_events_webhook_id_fkey' 
    AND table_name = 'webhook_events'
  ) THEN
    ALTER TABLE public.webhook_events 
    ADD CONSTRAINT webhook_events_webhook_id_fkey 
    FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'webhook_events_tenant_id_fkey' 
    AND table_name = 'webhook_events'
  ) THEN
    ALTER TABLE public.webhook_events 
    ADD CONSTRAINT webhook_events_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON public.webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_id ON public.webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_success ON public.webhook_events(success) WHERE success = false;
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_created ON public.webhook_events(webhook_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view webhook events in their tenant" ON public.webhook_events;
DROP POLICY IF EXISTS "Service role can manage webhook events" ON public.webhook_events;

-- Create RLS policies
CREATE POLICY "Users can view webhook events in their tenant"
  ON public.webhook_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage webhook events"
  ON public.webhook_events
  FOR ALL
  USING (
    (auth.jwt() ->> 'role'::text) = 'service_role'::text
  );