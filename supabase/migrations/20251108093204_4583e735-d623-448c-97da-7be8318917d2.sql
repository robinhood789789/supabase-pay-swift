-- Create missing shareholder-related tables
CREATE TABLE IF NOT EXISTS public.shareholder_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shareholder_id UUID NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    commission_rate NUMERIC NOT NULL DEFAULT 0.00,
    commission_type TEXT DEFAULT 'revenue_share',
    bounty_amount NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    referral_source TEXT,
    notes TEXT,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
    effective_to TIMESTAMP WITH TIME ZONE,
    referred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shareholder_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shareholder_id UUID NOT NULL REFERENCES public.shareholders(id),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    payment_id UUID,
    base_amount BIGINT NOT NULL,
    commission_rate NUMERIC NOT NULL,
    amount BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shareholder_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shareholder_id UUID NOT NULL REFERENCES public.shareholders(id),
    email TEXT NOT NULL,
    magic_token TEXT NOT NULL,
    temp_password_hash TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    invalidated_at TIMESTAMP WITH TIME ZONE,
    invalidation_reason TEXT,
    resent_count INTEGER NOT NULL DEFAULT 0,
    last_resent_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create views (idempotent)
CREATE OR REPLACE VIEW public.v_tx_daily_by_tenant AS
SELECT 
    tenant_id,
    DATE(created_at) as tx_date,
    SUM(CASE WHEN direction = 'IN' THEN net_amount ELSE 0 END) as net_in,
    SUM(CASE WHEN direction = 'OUT' THEN net_amount ELSE 0 END) as net_out,
    SUM(CASE WHEN type = 'DEPOSIT' THEN net_amount ELSE 0 END) as deposit_net,
    SUM(CASE WHEN type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) as withdrawal_net,
    SUM(CASE WHEN type = 'TRANSFER' THEN net_amount ELSE 0 END) as transfer_net,
    COUNT(*) as tx_count,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count
FROM public.transactions
GROUP BY tenant_id, DATE(created_at);

CREATE OR REPLACE VIEW public.v_tx_daily_by_shareholder AS
SELECT 
    shareholder_id,
    DATE(created_at) as tx_date,
    SUM(CASE WHEN direction = 'IN' THEN net_amount ELSE 0 END) as net_in,
    SUM(CASE WHEN direction = 'OUT' THEN net_amount ELSE 0 END) as net_out,
    SUM(CASE WHEN type = 'DEPOSIT' THEN net_amount ELSE 0 END) as deposit_net,
    SUM(CASE WHEN type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) as withdrawal_net,
    SUM(CASE WHEN type = 'TRANSFER' THEN net_amount ELSE 0 END) as transfer_net,
    COUNT(*) as tx_count,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count
FROM public.transactions
WHERE shareholder_id IS NOT NULL
GROUP BY shareholder_id, DATE(created_at);

CREATE OR REPLACE VIEW public.v_tx_monthly_by_shareholder AS
SELECT 
    shareholder_id,
    DATE_TRUNC('month', created_at) as tx_month,
    SUM(CASE WHEN direction = 'IN' THEN net_amount ELSE 0 END) as net_in,
    SUM(CASE WHEN direction = 'OUT' THEN net_amount ELSE 0 END) as net_out,
    SUM(CASE WHEN type = 'DEPOSIT' THEN net_amount ELSE 0 END) as deposit_net,
    SUM(CASE WHEN type = 'WITHDRAWAL' THEN net_amount ELSE 0 END) as withdrawal_net,
    SUM(CASE WHEN type = 'TRANSFER' THEN net_amount ELSE 0 END) as transfer_net,
    SUM(fee) as total_fees,
    COUNT(*) as tx_count,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count
FROM public.transactions
WHERE shareholder_id IS NOT NULL
GROUP BY shareholder_id, DATE_TRUNC('month', created_at);

-- Enable RLS only for existing tables
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables 
    WHERE schemaname='public' AND tablename IN (
      'tenants','roles','memberships','shareholders','shareholder_clients','shareholder_earnings','shareholder_invitations','transactions','tenant_wallets','payments','refunds','disputes','settlements','checkout_sessions','payment_links','kyc_documents','api_keys','webhook_events','provider_events','audit_logs','admin_activity','approvals','temporary_codes','rate_limits','hmac_replay_cache','id_sequences','role_assignments_log','role_templates','platform_settings','platform_security_policy','tenant_security_policy','platform_provider_credentials','platform_provisioning_tokens','alerts','alert_events','customers','guardrails','go_live_checklist','idempotency_keys'
    )
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;