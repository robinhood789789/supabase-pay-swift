-- Add 'owner' role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Add tenant_id to user_roles
ALTER TABLE public.user_roles 
ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX idx_tenants_owner_id ON public.tenants(owner_id);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);

-- RLS Policies for tenants
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can update their own tenant"
  ON public.tenants FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all tenants"
  ON public.tenants FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for user_roles to consider tenant
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view roles in their tenant"
  ON public.user_roles FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.tenants
      WHERE tenants.id = user_roles.tenant_id
      AND tenants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenant owners can manage roles"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants
      WHERE tenants.id = user_roles.tenant_id
      AND tenants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user function to create tenant and assign owner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  tenant_slug TEXT;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Generate unique tenant slug from email
  tenant_slug := LOWER(SPLIT_PART(NEW.email, '@', 1)) || '-' || SUBSTRING(NEW.id::text FROM 1 FOR 8);
  
  -- Create tenant for the new user
  INSERT INTO public.tenants (owner_id, name, slug)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Workspace',
    tenant_slug
  )
  RETURNING id INTO new_tenant_id;
  
  -- Assign 'owner' role with tenant association
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'owner', new_tenant_id);
  
  RETURN NEW;
END;
$$;

-- Trigger for tenants updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();