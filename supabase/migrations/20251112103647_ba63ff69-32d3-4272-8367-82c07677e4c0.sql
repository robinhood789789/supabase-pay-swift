-- Enable Row Level Security on incoming_transfers table
-- This table stores bank transfer data and must be protected

ALTER TABLE public.incoming_transfers ENABLE ROW LEVEL SECURITY;

-- Super admins can view all incoming transfers
CREATE POLICY "Super admins can view incoming transfers"
ON public.incoming_transfers
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admins can manage incoming transfers
CREATE POLICY "Super admins can manage incoming transfers"
ON public.incoming_transfers
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Service role can manage incoming transfers (for webhook processing)
CREATE POLICY "Service role can manage incoming transfers"
ON public.incoming_transfers
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);