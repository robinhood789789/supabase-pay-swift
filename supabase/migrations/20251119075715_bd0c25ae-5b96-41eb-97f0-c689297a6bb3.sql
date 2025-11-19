-- Add tenant_id to deposit_transfers table
ALTER TABLE public.deposit_transfers 
ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_deposit_transfers_tenant_id ON public.deposit_transfers(tenant_id);

-- Add RLS policy for shareholders to view their clients' deposit transfers
CREATE POLICY "Shareholders can view their clients deposit transfers"
ON public.deposit_transfers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shareholder_clients sc
    WHERE sc.tenant_id = deposit_transfers.tenant_id
    AND sc.shareholder_id = public.get_shareholder_id(auth.uid())
    AND sc.status = 'active'
  )
);

-- Add RLS policy for tenant members to view their own deposit transfers
CREATE POLICY "Tenant members can view their deposit transfers"
ON public.deposit_transfers
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid()
  )
);

-- Enable RLS on deposit_transfers if not already enabled
ALTER TABLE public.deposit_transfers ENABLE ROW LEVEL SECURITY;