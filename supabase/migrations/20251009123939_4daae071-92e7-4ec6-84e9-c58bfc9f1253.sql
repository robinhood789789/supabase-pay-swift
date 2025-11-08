-- Create go_live_checklist table to persist deployment readiness checks
CREATE TABLE IF NOT EXISTS public.go_live_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_tls boolean DEFAULT false,
  provider_credentials boolean DEFAULT false,
  webhook_verified boolean DEFAULT false,
  backup_schedule boolean DEFAULT false,
  admin_2fa boolean DEFAULT false,
  logs_alerts boolean DEFAULT false,
  test_transactions boolean DEFAULT false,
  notes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Create index on tenant_id
CREATE INDEX IF NOT EXISTS idx_go_live_checklist_tenant 
ON public.go_live_checklist(tenant_id);

-- Enable RLS
ALTER TABLE public.go_live_checklist ENABLE ROW LEVEL SECURITY;

-- Only owners can view and manage checklist for their tenant
CREATE POLICY "Owners can manage their tenant checklist"
ON public.go_live_checklist
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = go_live_checklist.tenant_id
      AND r.name = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = go_live_checklist.tenant_id
      AND r.name = 'owner'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_go_live_checklist_updated_at
BEFORE UPDATE ON public.go_live_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();