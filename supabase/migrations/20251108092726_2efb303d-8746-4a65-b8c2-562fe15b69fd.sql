-- Step 1: Create base tables first (no dependencies)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    kyc_status TEXT DEFAULT 'pending',
    kyc_level INTEGER DEFAULT 0,
    kyc_verified_at TIMESTAMP WITH TIME ZONE,
    kyc_verified_by UUID,
    kyc_notes TEXT,
    fee_plan JSONB DEFAULT '{}'::jsonb,
    risk_rules JSONB DEFAULT '{}'::jsonb,
    payout_bank_name TEXT,
    payout_bank_account TEXT,
    payout_schedule TEXT DEFAULT 'daily',
    brand_logo_url TEXT,
    brand_primary_color TEXT DEFAULT '#000000',
    tax_id TEXT,
    business_type TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    referred_by_code TEXT,
    referred_by_shareholder_id UUID,
    referral_accepted_at TIMESTAMP WITH TIME ZONE,
    user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.id_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix TEXT NOT NULL UNIQUE,
    current_value INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES
  ('owner', 'Full access to tenant'),
  ('admin', 'Administrative access'),
  ('manager', 'Management access'),
  ('finance', 'Finance operations'),
  ('developer', 'API and technical access'),
  ('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- Insert ID sequence prefixes  
INSERT INTO public.id_sequences (prefix, current_value) VALUES
  ('USR', 0),
  ('TNT', 0),
  ('SH', 0),
  ('TRX', 0)
ON CONFLICT (prefix) DO NOTHING;