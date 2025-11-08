-- Create enum for KYC document types
CREATE TYPE public.kyc_document_type AS ENUM (
  'national_id',
  'passport',
  'drivers_license',
  'business_registration',
  'tax_certificate',
  'bank_statement',
  'proof_of_address'
);

-- Create enum for KYC verification status
CREATE TYPE public.kyc_verification_status AS ENUM (
  'pending',
  'under_review',
  'approved',
  'rejected',
  'expired'
);

-- Create KYC documents table
CREATE TABLE public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type kyc_document_type NOT NULL,
  document_number TEXT,
  document_url TEXT,
  status kyc_verification_status DEFAULT 'pending' NOT NULL,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  expiry_date DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create KYC verification log table for audit trail
CREATE TABLE public.kyc_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.kyc_documents(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  previous_status kyc_verification_status,
  new_status kyc_verification_status,
  notes TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add Google OAuth metadata to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_verified_email BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_picture TEXT;

-- Add KYC level to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS kyc_level INTEGER DEFAULT 0 CHECK (kyc_level >= 0 AND kyc_level <= 3);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS kyc_verified_by UUID REFERENCES auth.users(id);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS kyc_notes TEXT;

-- Enable RLS on KYC tables
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verification_logs ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX idx_kyc_documents_tenant_id ON public.kyc_documents(tenant_id);
CREATE INDEX idx_kyc_documents_status ON public.kyc_documents(status);
CREATE INDEX idx_kyc_verification_logs_tenant_id ON public.kyc_verification_logs(tenant_id);
CREATE INDEX idx_kyc_verification_logs_created_at ON public.kyc_verification_logs(created_at DESC);
CREATE INDEX idx_profiles_google_id ON public.profiles(google_id) WHERE google_id IS NOT NULL;

-- RLS Policies for kyc_documents
-- Users can view their own tenant's KYC documents
CREATE POLICY "Users can view own tenant KYC documents"
  ON public.kyc_documents
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- Super admins can view all KYC documents
CREATE POLICY "Super admins can view all KYC documents"
  ON public.kyc_documents
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Users with kyc.manage permission can insert documents
CREATE POLICY "Users can insert KYC documents"
  ON public.kyc_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id 
      FROM public.memberships m
      JOIN public.role_permissions rp ON m.role_id = rp.role_id
      JOIN public.permissions p ON rp.permission_id = p.id
      WHERE m.user_id = auth.uid() 
      AND p.name = 'kyc.manage'
    )
  );

-- Super admins can update KYC documents (for verification)
CREATE POLICY "Super admins can update KYC documents"
  ON public.kyc_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- RLS Policies for kyc_verification_logs
-- Users can view logs for their tenant
CREATE POLICY "Users can view own tenant KYC logs"
  ON public.kyc_verification_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- Super admins can view all logs
CREATE POLICY "Super admins can view all KYC logs"
  ON public.kyc_verification_logs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- System can insert logs
CREATE POLICY "Authenticated users can insert KYC logs"
  ON public.kyc_verification_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger for updated_at on kyc_documents
CREATE TRIGGER update_kyc_documents_updated_at
  BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create function to update tenant KYC status based on documents
CREATE OR REPLACE FUNCTION public.update_tenant_kyc_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved_docs_count INTEGER;
  required_docs_count INTEGER;
  new_kyc_level INTEGER;
BEGIN
  -- Count approved documents
  SELECT COUNT(*) INTO approved_docs_count
  FROM public.kyc_documents
  WHERE tenant_id = NEW.tenant_id
  AND status = 'approved';

  -- Determine KYC level based on approved documents
  IF approved_docs_count >= 5 THEN
    new_kyc_level := 3; -- Full verification
  ELSIF approved_docs_count >= 3 THEN
    new_kyc_level := 2; -- Enhanced verification
  ELSIF approved_docs_count >= 1 THEN
    new_kyc_level := 1; -- Basic verification
  ELSE
    new_kyc_level := 0; -- Not verified
  END IF;

  -- Update tenant KYC level and status
  UPDATE public.tenants
  SET 
    kyc_level = new_kyc_level,
    kyc_status = CASE 
      WHEN new_kyc_level >= 2 THEN 'verified'
      WHEN new_kyc_level = 1 THEN 'pending'
      ELSE 'pending'
    END,
    kyc_verified_at = CASE 
      WHEN new_kyc_level >= 2 THEN now()
      ELSE kyc_verified_at
    END,
    kyc_verified_by = CASE 
      WHEN new_kyc_level >= 2 THEN NEW.verified_by
      ELSE kyc_verified_by
    END
  WHERE id = NEW.tenant_id;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-update tenant KYC status
CREATE TRIGGER trigger_update_tenant_kyc_status
  AFTER INSERT OR UPDATE OF status ON public.kyc_documents
  FOR EACH ROW
  WHEN (NEW.status = 'approved' OR NEW.status = 'rejected')
  EXECUTE FUNCTION public.update_tenant_kyc_status();

-- Insert KYC permission if not exists
INSERT INTO public.permissions (name, description)
VALUES ('kyc.manage', 'Manage KYC documents and verification')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.permissions (name, description)
VALUES ('kyc.verify', 'Verify and approve KYC documents')
ON CONFLICT (name) DO NOTHING;

-- Grant KYC permissions to owner and admin roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('owner', 'admin')
AND p.name IN ('kyc.manage', 'kyc.verify')
ON CONFLICT DO NOTHING;