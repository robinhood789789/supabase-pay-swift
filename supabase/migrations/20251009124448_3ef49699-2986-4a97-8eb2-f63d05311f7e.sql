-- Create settlements table for financial reconciliation
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  cycle text NOT NULL,
  paid_out_at timestamptz,
  fees bigint NOT NULL DEFAULT 0,
  net_amount bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on tenant_id for performance
CREATE INDEX idx_settlements_tenant ON public.settlements(tenant_id);

-- Enable RLS
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Users can view settlements in their tenant
CREATE POLICY "Users can view settlements in their tenant"
ON public.settlements
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add reconciliation status to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS reconciliation_status text DEFAULT 'unmatched',
ADD COLUMN IF NOT EXISTS settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

-- Create index for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_payments_reconciliation 
ON public.payments(tenant_id, reconciliation_status, paid_at);

-- Add trigger for settlements updated_at
CREATE TRIGGER update_settlements_updated_at
BEFORE UPDATE ON public.settlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();