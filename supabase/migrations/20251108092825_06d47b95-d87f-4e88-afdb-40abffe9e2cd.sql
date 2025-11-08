-- Step 2: Create dependent tables (depend on roles, tenants, auth.users)
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.shareholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    balance BIGINT NOT NULL DEFAULT 0,
    total_earnings BIGINT NOT NULL DEFAULT 0,
    active_clients_count INTEGER NOT NULL DEFAULT 0,
    default_commission_type TEXT DEFAULT 'revenue_share',
    default_commission_value NUMERIC DEFAULT 0,
    allow_self_adjust BOOLEAN DEFAULT false,
    adjust_min_percent NUMERIC DEFAULT 0,
    adjust_max_percent NUMERIC DEFAULT 30,
    referral_code TEXT UNIQUE,
    referral_count INTEGER DEFAULT 0,
    total_commission_earned NUMERIC DEFAULT 0,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    currency TEXT NOT NULL DEFAULT 'THB',
    balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    checkout_session_id UUID,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    method TEXT,
    provider TEXT,
    provider_payment_id TEXT,
    type TEXT DEFAULT 'deposit',
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    withdrawal_notes TEXT,
    metadata JSONB,
    paid_at TIMESTAMP WITH TIME ZONE,
    reconciliation_status TEXT DEFAULT 'unmatched',
    reconciled_at TIMESTAMP WITH TIME ZONE,
    settlement_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    payment_id UUID,
    amount BIGINT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_refund_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'open',
    stage TEXT NOT NULL DEFAULT 'inquiry',
    evidence_url TEXT,
    due_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL,
    cycle TEXT NOT NULL,
    net_amount BIGINT NOT NULL,
    fees BIGINT NOT NULL DEFAULT 0,
    paid_out_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    method_types JSONB NOT NULL,
    reference TEXT,
    provider TEXT,
    provider_session_id TEXT,
    redirect_url TEXT,
    qr_image_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    slug TEXT NOT NULL UNIQUE,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL,
    reference TEXT,
    status TEXT DEFAULT 'active',
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    document_type public.kyc_document_type NOT NULL,
    document_number TEXT,
    document_url TEXT,
    status public.kyc_verification_status NOT NULL DEFAULT 'pending',
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    expiry_date DATE,
    rejection_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    hashed_key TEXT NOT NULL,
    key_type public.api_key_type NOT NULL,
    scope JSONB DEFAULT '[]'::jsonb,
    allowed_operations JSONB DEFAULT '[]'::jsonb,
    rate_limit_tier TEXT DEFAULT 'standard',
    ip_allowlist JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    provider TEXT,
    event_type TEXT,
    payload JSONB,
    status TEXT DEFAULT 'queued',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    actor_user_id UUID,
    action TEXT NOT NULL,
    target TEXT,
    before JSONB,
    after JSONB,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL,
    action TEXT NOT NULL,
    target_tenant_id UUID,
    target_user_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    action_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by UUID NOT NULL,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.temporary_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID NOT NULL,
    code TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    issued_by UUID,
    issued_from_context TEXT,
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(identifier, endpoint, window_start)
);

CREATE TABLE IF NOT EXISTS public.hmac_replay_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id TEXT NOT NULL,
    signature_hash TEXT NOT NULL UNIQUE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_assignments_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    action TEXT NOT NULL,
    previous_role_id UUID,
    assigned_by UUID,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    category TEXT DEFAULT 'general',
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_security_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    force_2fa_for_super_admin BOOLEAN NOT NULL DEFAULT true,
    force_2fa_for_all_roles BOOLEAN DEFAULT true,
    default_require_2fa_for_owner BOOLEAN NOT NULL DEFAULT true,
    default_require_2fa_for_admin BOOLEAN NOT NULL DEFAULT true,
    default_stepup_window_seconds INTEGER NOT NULL DEFAULT 300,
    first_login_require_mfa BOOLEAN DEFAULT true,
    first_login_require_password_change BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_security_policy (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    require_2fa_for_owner BOOLEAN DEFAULT true,
    require_2fa_for_admin BOOLEAN DEFAULT true,
    require_2fa_for_manager BOOLEAN DEFAULT true,
    require_2fa_for_finance BOOLEAN DEFAULT false,
    require_2fa_for_developer BOOLEAN DEFAULT false,
    stepup_window_seconds INTEGER DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_provider_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    mode TEXT NOT NULL,
    public_key TEXT,
    secret_key TEXT,
    merchant_id TEXT,
    webhook_secret TEXT,
    feature_flags JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    last_rotated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_provisioning_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id TEXT NOT NULL UNIQUE,
    platform_name TEXT NOT NULL,
    hashed_secret TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    notes TEXT,
    ip_allowlist JSONB DEFAULT '[]'::jsonb,
    allowed_tenants JSONB DEFAULT '["*"]'::jsonb,
    created_by UUID,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    condition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES public.alerts(id),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    data JSONB
);

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    email TEXT NOT NULL,
    name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guardrails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    rule_type TEXT NOT NULL,
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.go_live_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    item TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    tenant_id UUID,
    response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);