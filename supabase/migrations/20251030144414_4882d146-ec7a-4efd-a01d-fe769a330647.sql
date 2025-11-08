-- Create shareholder role in permissions
INSERT INTO public.permissions (name, description)
VALUES 
  ('shareholder.dashboard', 'View shareholder dashboard'),
  ('shareholder.clients', 'View referred clients'),
  ('shareholder.commissions', 'Manage commission rates'),
  ('shareholder.earnings', 'View earnings and balance'),
  ('shareholder.reports', 'View shareholder reports')
ON CONFLICT (name) DO NOTHING;

-- Create shareholders table to store shareholder-specific data
CREATE TABLE IF NOT EXISTS public.shareholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  balance BIGINT NOT NULL DEFAULT 0,
  total_earnings BIGINT NOT NULL DEFAULT 0,
  active_clients_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  notes TEXT,
  UNIQUE(user_id)
);

-- Create shareholder_clients table to track which owner users belong to which shareholder
CREATE TABLE IF NOT EXISTS public.shareholder_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  referred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(shareholder_id, tenant_id)
);

-- Create shareholder_earnings table to track earnings history
CREATE TABLE IF NOT EXISTS public.shareholder_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  base_amount BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled'))
);

-- Create shareholder_withdrawals table for shareholder withdrawal requests
CREATE TABLE IF NOT EXISTS public.shareholder_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  bank_name TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_account_name TEXT NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT
);

-- Enable RLS on all shareholder tables
ALTER TABLE public.shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholder_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholder_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholder_withdrawals ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is a shareholder
CREATE OR REPLACE FUNCTION public.is_shareholder(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shareholders
    WHERE user_id = user_uuid AND status = 'active'
  );
$$;

-- Create security definer function to get shareholder id from user id
CREATE OR REPLACE FUNCTION public.get_shareholder_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM public.shareholders
  WHERE user_id = user_uuid AND status = 'active'
  LIMIT 1;
$$;

-- RLS Policies for shareholders table
CREATE POLICY "Super admins can manage all shareholders"
ON public.shareholders
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Shareholders can view their own data"
ON public.shareholders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Shareholders can update their own data"
ON public.shareholders
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for shareholder_clients table
CREATE POLICY "Super admins can manage all shareholder clients"
ON public.shareholder_clients
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Shareholders can view their clients"
ON public.shareholder_clients
FOR SELECT
TO authenticated
USING (shareholder_id = get_shareholder_id(auth.uid()));

CREATE POLICY "Shareholders can update their clients commission"
ON public.shareholder_clients
FOR UPDATE
TO authenticated
USING (shareholder_id = get_shareholder_id(auth.uid()))
WITH CHECK (shareholder_id = get_shareholder_id(auth.uid()));

-- RLS Policies for shareholder_earnings table
CREATE POLICY "Super admins can view all earnings"
ON public.shareholder_earnings
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Shareholders can view their earnings"
ON public.shareholder_earnings
FOR SELECT
TO authenticated
USING (shareholder_id = get_shareholder_id(auth.uid()));

-- RLS Policies for shareholder_withdrawals table
CREATE POLICY "Super admins can manage all withdrawals"
ON public.shareholder_withdrawals
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Shareholders can view their withdrawals"
ON public.shareholder_withdrawals
FOR SELECT
TO authenticated
USING (shareholder_id = get_shareholder_id(auth.uid()));

CREATE POLICY "Shareholders can create withdrawals"
ON public.shareholder_withdrawals
FOR INSERT
TO authenticated
WITH CHECK (shareholder_id = get_shareholder_id(auth.uid()));

-- Create trigger to update shareholders updated_at
CREATE TRIGGER update_shareholders_updated_at
BEFORE UPDATE ON public.shareholders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_shareholder_clients_updated_at
BEFORE UPDATE ON public.shareholder_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shareholders_user_id ON public.shareholders(user_id);
CREATE INDEX IF NOT EXISTS idx_shareholders_status ON public.shareholders(status);
CREATE INDEX IF NOT EXISTS idx_shareholder_clients_shareholder_id ON public.shareholder_clients(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_clients_tenant_id ON public.shareholder_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_earnings_shareholder_id ON public.shareholder_earnings(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_earnings_tenant_id ON public.shareholder_earnings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_withdrawals_shareholder_id ON public.shareholder_withdrawals(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_withdrawals_status ON public.shareholder_withdrawals(status);