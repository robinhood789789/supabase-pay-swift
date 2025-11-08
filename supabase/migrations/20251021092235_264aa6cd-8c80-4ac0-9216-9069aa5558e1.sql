-- Add tenant security policy table
CREATE TABLE IF NOT EXISTS public.tenant_security_policy (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  require_2fa_for_owner boolean DEFAULT true,
  require_2fa_for_admin boolean DEFAULT true,
  stepup_window_seconds integer DEFAULT 300,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_security_policy ENABLE ROW LEVEL SECURITY;

-- Users can view their tenant security policy
CREATE POLICY "Users can view their tenant security policy"
  ON public.tenant_security_policy
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Owners can manage their tenant security policy
CREATE POLICY "Owners can manage their tenant security policy"
  ON public.tenant_security_policy
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = tenant_security_policy.tenant_id
        AND r.name = 'owner'
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_tenant_security_policy_updated_at
  BEFORE UPDATE ON public.tenant_security_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add mfa_last_verified_at to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mfa_last_verified_at timestamp with time zone;