-- Phase 1: Foundation - Extend tenants table for merchant data
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS kyc_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS payout_bank_name text,
ADD COLUMN IF NOT EXISTS payout_bank_account text,
ADD COLUMN IF NOT EXISTS payout_schedule text DEFAULT 'daily' CHECK (payout_schedule IN ('daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS brand_logo_url text,
ADD COLUMN IF NOT EXISTS brand_primary_color text DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS tax_id text,
ADD COLUMN IF NOT EXISTS business_type text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS fee_plan jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS risk_rules jsonb DEFAULT '{}';

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('card', 'thai_qr', 'truemoney', 'alipay', 'wechat', 'bank_transfer')),
  enabled boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods(tenant_id);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment methods in their tenant"
  ON public.payment_methods FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage payment methods"
  ON public.payment_methods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = payment_methods.tenant_id
        AND r.name = 'owner'
    )
  );

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products in their tenant"
  ON public.products FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users with products.write can manage products"
  ON public.products FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create prices table
CREATE TABLE IF NOT EXISTS public.prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  currency text NOT NULL DEFAULT 'THB',
  recurring boolean DEFAULT false,
  recurring_interval text CHECK (recurring_interval IN ('day', 'week', 'month', 'year')),
  recurring_interval_count integer DEFAULT 1,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prices_product ON public.prices(product_id);

ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view prices for their tenant products"
  ON public.prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = prices.product_id
        AND p.tenant_id = get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Users with products.write can manage prices"
  ON public.prices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = prices.product_id
        AND p.tenant_id = get_user_tenant_id(auth.uid())
    )
  );

-- Create disputes table
CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'inquiry' CHECK (stage IN ('inquiry', 'chargeback', 'pre_arbitration', 'won', 'lost')),
  reason text,
  amount bigint NOT NULL,
  currency text NOT NULL,
  due_at timestamp with time zone,
  evidence_url text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'won', 'lost')),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_payment ON public.disputes(payment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_tenant ON public.disputes(tenant_id);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view disputes in their tenant"
  ON public.disputes FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users with disputes.write can manage disputes"
  ON public.disputes FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add granular permissions
INSERT INTO public.permissions (name, description) VALUES
  ('transactions.read', 'View transactions'),
  ('transactions.refund', 'Create refunds'),
  ('products.read', 'View products and prices'),
  ('products.write', 'Manage products and prices'),
  ('disputes.read', 'View disputes'),
  ('disputes.write', 'Manage disputes and submit evidence'),
  ('merchant.settings.read', 'View merchant settings'),
  ('merchant.settings.write', 'Modify merchant settings'),
  ('users.manage', 'Manage merchant staff users'),
  ('platform.tenants.manage', 'Manage all tenants (Super Admin)'),
  ('platform.users.manage', 'Manage all users (Super Admin)'),
  ('platform.config.write', 'Configure platform settings (Super Admin)'),
  ('platform.audit.read', 'View all audit logs (Super Admin)')
ON CONFLICT (name) DO NOTHING;

-- Add super_admin flag to profiles for platform-level access
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- Create super admin check function
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = user_uuid),
    false
  );
$$;

-- Update tenants RLS to allow super admin access
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view their tenant"
  ON public.tenants FOR SELECT
  USING (
    id = get_user_tenant_id(auth.uid()) 
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage all tenants"
  ON public.tenants FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Update memberships RLS to allow super admin access
CREATE POLICY "Super admins can view all memberships"
  ON public.memberships FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all memberships"
  ON public.memberships FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Update profiles RLS to allow super admin to view all
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Update audit_logs to allow super admin access
CREATE POLICY "Super admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at on new tables
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();