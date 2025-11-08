-- Add MFA requirements for additional roles in tenant_security_policy
ALTER TABLE public.tenant_security_policy 
ADD COLUMN IF NOT EXISTS require_2fa_for_manager boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS require_2fa_for_finance boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS require_2fa_for_developer boolean DEFAULT false;