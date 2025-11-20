-- Allow all tenant members (including viewer) to view their tenant's withdraw transfers
CREATE POLICY "Tenant members can view their withdraw transfers"
ON public.withdraw_transfers
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT m.tenant_id
    FROM memberships m
    WHERE m.user_id = auth.uid()
  )
);