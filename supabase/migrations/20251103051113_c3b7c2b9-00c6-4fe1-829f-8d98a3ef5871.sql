-- Add referral_code to shareholders table
ALTER TABLE public.shareholders
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_commission_earned NUMERIC(15,2) DEFAULT 0;

-- Add referred_by columns to tenants table  
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS referred_by_shareholder_id UUID REFERENCES public.shareholders(id),
ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
ADD COLUMN IF NOT EXISTS referral_accepted_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster referral code lookups
CREATE INDEX IF NOT EXISTS idx_shareholders_referral_code ON public.shareholders(referral_code);
CREATE INDEX IF NOT EXISTS idx_tenants_referred_by ON public.tenants(referred_by_shareholder_id);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8 character code: SH + 6 random uppercase alphanumeric
    new_code := 'SH' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM shareholders WHERE referral_code = new_code) INTO code_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Trigger to auto-generate referral code for new shareholders
CREATE OR REPLACE FUNCTION assign_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_referral_code
BEFORE INSERT ON public.shareholders
FOR EACH ROW
EXECUTE FUNCTION assign_referral_code();

-- Update existing shareholders with referral codes
UPDATE public.shareholders
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Function to track referral signup
CREATE OR REPLACE FUNCTION track_referral_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  shareholder_record RECORD;
BEGIN
  -- If tenant has referral code, link it to shareholder
  IF NEW.referred_by_code IS NOT NULL THEN
    -- Find shareholder by code
    SELECT * INTO shareholder_record
    FROM public.shareholders
    WHERE referral_code = NEW.referred_by_code
    AND status = 'active';
    
    IF FOUND THEN
      -- Update tenant with shareholder link
      NEW.referred_by_shareholder_id := shareholder_record.id;
      NEW.referral_accepted_at := now();
      
      -- Create shareholder_clients record
      INSERT INTO public.shareholder_clients (
        shareholder_id,
        tenant_id,
        commission_rate,
        status,
        referral_source
      ) VALUES (
        shareholder_record.id,
        NEW.id,
        5.0, -- Default 5% commission
        'active',
        'referral_code'
      );
      
      -- Update shareholder referral count
      UPDATE public.shareholders
      SET referral_count = referral_count + 1
      WHERE id = shareholder_record.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_referral_signup
BEFORE INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION track_referral_signup();

-- Add comment for documentation
COMMENT ON COLUMN shareholders.referral_code IS 'Unique referral code for tracking signups (e.g., SH1A2B3C)';
COMMENT ON COLUMN tenants.referred_by_code IS 'Referral code used during signup';
COMMENT ON COLUMN tenants.referred_by_shareholder_id IS 'Shareholder who referred this tenant';