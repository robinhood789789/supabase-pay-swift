-- Enable RLS for topup_transfers
ALTER TABLE topup_transfers ENABLE ROW LEVEL SECURITY;

-- Create policy for owners and managers to view topup_transfers
CREATE POLICY "Owners, managers and finance can view topup transfers"
ON topup_transfers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM memberships m
    JOIN roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'manager', 'finance')
  )
);

-- Create policy for super admins to view topup_transfers
CREATE POLICY "Super admins can view topup transfers"
ON topup_transfers
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Enable RLS for settlement_transfers
ALTER TABLE settlement_transfers ENABLE ROW LEVEL SECURITY;

-- Create policy for owners and managers to view settlement_transfers
CREATE POLICY "Owners, managers and finance can view settlement transfers"
ON settlement_transfers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM memberships m
    JOIN roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'manager', 'finance')
  )
);

-- Create policy for super admins to view settlement_transfers
CREATE POLICY "Super admins can view settlement transfers"
ON settlement_transfers
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Enable RLS for withdraw_transfers (if needed)
ALTER TABLE withdraw_transfers ENABLE ROW LEVEL SECURITY;

-- Create policy for owners and managers to view withdraw_transfers
CREATE POLICY "Owners, managers and finance can view withdraw transfers"
ON withdraw_transfers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM memberships m
    JOIN roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'manager', 'finance')
  )
);

-- Create policy for super admins to view withdraw_transfers
CREATE POLICY "Super admins can view withdraw transfers"
ON withdraw_transfers
FOR SELECT
USING (is_super_admin(auth.uid()));