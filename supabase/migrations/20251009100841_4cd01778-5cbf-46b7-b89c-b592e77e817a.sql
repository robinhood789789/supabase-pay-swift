-- Drop existing multi-tenancy tables (from previous migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Tenancy & Users
CREATE TABLE public.tenants(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.roles(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_system boolean DEFAULT false
);

CREATE TABLE public.permissions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text
);

CREATE TABLE public.role_permissions(
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE public.memberships(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Security/Audit
CREATE TABLE public.audit_logs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  target text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Payments Core
CREATE TABLE public.checkout_sessions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  currency text NOT NULL,
  reference text,
  method_types jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider text,
  provider_session_id text,
  redirect_url text,
  qr_image_url text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.payments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  checkout_session_id uuid REFERENCES checkout_sessions(id) ON DELETE SET NULL,
  amount bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  method text,
  provider text,
  provider_payment_id text,
  paid_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.refunds(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  provider_refund_id text,
  created_at timestamptz DEFAULT now()
);

-- Webhooks inbound/outbound + events
CREATE TABLE public.provider_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text UNIQUE NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz DEFAULT now()
);

CREATE TABLE public.webhooks(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.webhook_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  provider text,
  event_type text,
  payload jsonb,
  status text DEFAULT 'queued',
  attempts int DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now()
);

-- Payment Links
CREATE TABLE public.payment_links(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  amount bigint NOT NULL,
  currency text NOT NULL,
  reference text,
  expires_at timestamptz,
  usage_limit int,
  used_count int DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Customers
CREATE TABLE public.customers(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's tenant from membership
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.memberships WHERE user_id = user_uuid LIMIT 1;
$$;

-- Helper function to check if user has specific role in tenant
CREATE OR REPLACE FUNCTION public.user_has_role_in_tenant(user_uuid uuid, role_name text, tenant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = user_uuid
      AND m.tenant_id = tenant_uuid
      AND r.name = role_name
  );
$$;

-- Basic RLS Policies: Users can access their own tenant's data
CREATE POLICY "Users can view their tenant"
ON public.tenants FOR SELECT
USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view memberships in their tenant"
ON public.memberships FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view their own membership"
ON public.memberships FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view roles in their tenant"
ON public.roles FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view all permissions"
ON public.permissions FOR SELECT
USING (true);

CREATE POLICY "Users can view role permissions in their tenant"
ON public.role_permissions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.roles
  WHERE id = role_permissions.role_id
    AND tenant_id = public.get_user_tenant_id(auth.uid())
));

CREATE POLICY "Users can view audit logs in their tenant"
ON public.audit_logs FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view checkout sessions in their tenant"
ON public.checkout_sessions FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view payments in their tenant"
ON public.payments FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view refunds in their tenant"
ON public.refunds FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view webhooks in their tenant"
ON public.webhooks FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view webhook events in their tenant"
ON public.webhook_events FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view payment links in their tenant"
ON public.payment_links FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view customers in their tenant"
ON public.customers FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Recreate user signup trigger with new schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  owner_role_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Create tenant for the new user
  INSERT INTO public.tenants (name, status)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Workspace',
    'active'
  )
  RETURNING id INTO new_tenant_id;
  
  -- Create 'owner' role for this tenant
  INSERT INTO public.roles (tenant_id, name, description, is_system)
  VALUES (new_tenant_id, 'owner', 'Tenant owner with full access', true)
  RETURNING id INTO owner_role_id;
  
  -- Assign user to tenant with owner role
  INSERT INTO public.memberships (user_id, tenant_id, role_id)
  VALUES (NEW.id, new_tenant_id, owner_role_id);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();