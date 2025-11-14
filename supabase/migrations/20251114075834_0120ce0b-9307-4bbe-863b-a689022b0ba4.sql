-- Add RLS policy for deposit_transfers table to allow owner, manager, and finance roles to view data

-- Policy for owners, managers, and finance to view deposit_transfers
CREATE POLICY "Owners, managers and finance can view deposit transfers"
ON public.deposit_transfers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'manager', 'finance')
  )
);

-- Policy for owners, managers and finance to insert deposit transfers
CREATE POLICY "Owners, managers and finance can create deposit transfers"
ON public.deposit_transfers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'manager', 'finance')
  )
);

-- Policy for owners, managers and finance to update deposit transfers
CREATE POLICY "Owners, managers and finance can update deposit transfers"
ON public.deposit_transfers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'manager', 'finance')
  )
);