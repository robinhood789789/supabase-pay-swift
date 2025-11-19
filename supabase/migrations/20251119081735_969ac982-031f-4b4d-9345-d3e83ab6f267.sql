-- Add RLS policy to allow shareholders to view tenants they manage
CREATE POLICY "Shareholders can view their managed tenants"
ON public.tenants
FOR SELECT
USING (
  id IN (
    SELECT tenant_id 
    FROM public.shareholder_clients
    WHERE shareholder_id = public.get_shareholder_id(auth.uid())
    AND status = 'active'
  )
);