-- Create temporary_codes table for onboarding invites
CREATE TABLE public.temporary_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('onboard_invite', 'role_assignment', 'password_reset')),
  issued_by UUID REFERENCES auth.users(id),
  issued_from_context TEXT,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  claimed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add onboarding fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboard_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX idx_temporary_codes_code ON public.temporary_codes(code) WHERE is_active = true;
CREATE INDEX idx_temporary_codes_user ON public.temporary_codes(user_id);
CREATE INDEX idx_temporary_codes_expires ON public.temporary_codes(expires_at) WHERE is_active = true;
CREATE INDEX idx_temporary_codes_tenant ON public.temporary_codes(tenant_id);

-- Enable RLS
ALTER TABLE public.temporary_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can manage all temporary codes"
ON public.temporary_codes FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users can view temporary codes they issued"
ON public.temporary_codes FOR SELECT
TO authenticated
USING (issued_by = auth.uid());

CREATE POLICY "Shareholders can view codes for their clients"
ON public.temporary_codes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shareholder_clients sc
    WHERE sc.tenant_id = temporary_codes.tenant_id
    AND sc.shareholder_id = get_shareholder_id(auth.uid())
  )
);

CREATE POLICY "Service role can manage temporary codes"
ON public.temporary_codes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_temporary_codes_updated_at
BEFORE UPDATE ON public.temporary_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Function to cleanup expired codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.temporary_codes
  SET is_active = false,
      updated_at = now()
  WHERE is_active = true
  AND expires_at < now();
END;
$$;