-- Force drop transactions and merchants tables
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.merchants CASCADE;

-- Recreate transactions with proper structure
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    owner_user_id UUID,
    owner_tenant_id UUID,
    shareholder_id UUID REFERENCES public.shareholders(id),
    type public.tx_type NOT NULL,
    direction public.tx_direction NOT NULL,
    status public.tx_status NOT NULL DEFAULT 'PENDING',
    method public.tx_method NOT NULL,
    amount NUMERIC NOT NULL,
    fee NUMERIC NOT NULL DEFAULT 0.00,
    net_amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'THB',
    reference TEXT,
    counterparty TEXT,
    note TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by_id UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);