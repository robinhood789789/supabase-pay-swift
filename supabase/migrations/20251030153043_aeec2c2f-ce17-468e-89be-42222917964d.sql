-- Upgrade shareholders table with commission policy fields
ALTER TABLE public.shareholders
ADD COLUMN IF NOT EXISTS default_commission_type text DEFAULT 'revenue_share' CHECK (default_commission_type IN ('bounty', 'revenue_share', 'hybrid')),
ADD COLUMN IF NOT EXISTS default_commission_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS allow_self_adjust boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS adjust_min_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS adjust_max_percent numeric DEFAULT 30;

-- Upgrade shareholder_clients table with enhanced commission fields
ALTER TABLE public.shareholder_clients
ADD COLUMN IF NOT EXISTS commission_type text DEFAULT 'revenue_share' CHECK (commission_type IN ('bounty', 'revenue_share', 'hybrid')),
ADD COLUMN IF NOT EXISTS bounty_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS effective_from timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS effective_to timestamptz,
ADD COLUMN IF NOT EXISTS referral_source text;

-- Create shareholder_commission_events table (append-only for audit)
CREATE TABLE IF NOT EXISTS public.shareholder_commission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id uuid NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('signup_bounty', 'processing_volume', 'platform_fee_share', 'manual_adjust')),
  base_value numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source_id uuid,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_shareholder_commission_events_shareholder ON public.shareholder_commission_events(shareholder_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_shareholder_commission_events_tenant ON public.shareholder_commission_events(tenant_id);

-- Create shareholder_adjust_requests table (for commission % change requests)
CREATE TABLE IF NOT EXISTS public.shareholder_adjust_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id uuid NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  current_percent numeric NOT NULL,
  requested_percent numeric NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_shareholder_adjust_requests_shareholder ON public.shareholder_adjust_requests(shareholder_id, status);
CREATE INDEX IF NOT EXISTS idx_shareholder_adjust_requests_status ON public.shareholder_adjust_requests(status) WHERE status = 'pending';

-- Enable RLS on new tables
ALTER TABLE public.shareholder_commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholder_adjust_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for shareholder_commission_events
CREATE POLICY "Shareholders can view their commission events"
ON public.shareholder_commission_events
FOR SELECT
USING (shareholder_id = get_shareholder_id(auth.uid()));

CREATE POLICY "Super admins can view all commission events"
ON public.shareholder_commission_events
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Service role can insert commission events"
ON public.shareholder_commission_events
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS policies for shareholder_adjust_requests
CREATE POLICY "Shareholders can view their adjust requests"
ON public.shareholder_adjust_requests
FOR SELECT
USING (shareholder_id = get_shareholder_id(auth.uid()));

CREATE POLICY "Shareholders can create adjust requests"
ON public.shareholder_adjust_requests
FOR INSERT
WITH CHECK (shareholder_id = get_shareholder_id(auth.uid()) AND requested_by = auth.uid());

CREATE POLICY "Super admins can manage all adjust requests"
ON public.shareholder_adjust_requests
FOR ALL
USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_shareholder_adjust_requests_updated_at
BEFORE UPDATE ON public.shareholder_adjust_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.shareholder_commission_events IS 'Append-only log of all commission events for shareholders';
COMMENT ON TABLE public.shareholder_adjust_requests IS 'Commission adjustment requests from shareholders requiring approval';