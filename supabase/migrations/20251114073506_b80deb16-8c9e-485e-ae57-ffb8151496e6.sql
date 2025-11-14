-- Add RLS policies for deposit_transfers table to allow owner access
ALTER TABLE deposit_transfers ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage deposit_transfers
CREATE POLICY "Service role can manage deposit transfers"
ON deposit_transfers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow super admins to view all deposit transfers
CREATE POLICY "Super admins can view deposit transfers"
ON deposit_transfers
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Allow super admins to manage deposit transfers
CREATE POLICY "Super admins can manage deposit transfers"
ON deposit_transfers
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));