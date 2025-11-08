-- Add public_id to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_public_id ON profiles(public_id);

-- Create id_sequences table for generating sequential public IDs
CREATE TABLE IF NOT EXISTS public.id_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix TEXT NOT NULL UNIQUE,
  current_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on id_sequences
ALTER TABLE public.id_sequences ENABLE ROW LEVEL SECURITY;

-- Only service role and super admins can manage sequences
CREATE POLICY "Service role can manage id_sequences"
ON public.id_sequences
FOR ALL
USING (
  (auth.jwt()->>'role' = 'service_role') OR 
  is_super_admin(auth.uid())
);

-- Initialize sequences for shareholder and owner
INSERT INTO public.id_sequences (prefix, current_value)
VALUES 
  ('SH', 0),
  ('OW', 0)
ON CONFLICT (prefix) DO NOTHING;

-- Function to generate next public_id
CREATE OR REPLACE FUNCTION public.generate_public_id(prefix_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_value INTEGER;
  new_public_id TEXT;
BEGIN
  -- Lock and increment the sequence
  UPDATE public.id_sequences
  SET 
    current_value = current_value + 1,
    updated_at = now()
  WHERE prefix = prefix_code
  RETURNING current_value INTO next_value;
  
  IF next_value IS NULL THEN
    RAISE EXCEPTION 'Sequence prefix % not found', prefix_code;
  END IF;
  
  -- Format as PREFIX-NNNNNN (6 digits)
  new_public_id := prefix_code || '-' || LPAD(next_value::TEXT, 6, '0');
  
  RETURN new_public_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.generate_public_id IS 'Generates sequential public IDs with format PREFIX-NNNNNN. Example: SH-000001, OW-000001';