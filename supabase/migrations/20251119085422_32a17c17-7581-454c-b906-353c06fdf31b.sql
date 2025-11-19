-- Add RLS policy for shareholders to view incoming_transfers
CREATE POLICY "Shareholders can view incoming transfers"
ON public.incoming_transfers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM shareholders s
    WHERE s.user_id = auth.uid()
    AND s.status = 'active'
  )
);