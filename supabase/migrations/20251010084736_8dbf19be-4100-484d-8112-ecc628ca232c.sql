-- Add transaction type to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS type text DEFAULT 'deposit' CHECK (type IN ('deposit', 'withdrawal'));

-- Create tenant wallets table for balance tracking
CREATE TABLE IF NOT EXISTS public.tenant_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_wallets ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_wallets
CREATE POLICY "Users can view their tenant wallet"
ON public.tenant_wallets
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Initialize wallet for existing tenants
INSERT INTO public.tenant_wallets (tenant_id, balance)
SELECT id, 0 FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION public.update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'succeeded' THEN
    IF NEW.type = 'deposit' THEN
      UPDATE public.tenant_wallets
      SET balance = balance + NEW.amount,
          updated_at = now()
      WHERE tenant_id = NEW.tenant_id;
    ELSIF NEW.type = 'withdrawal' THEN
      UPDATE public.tenant_wallets
      SET balance = balance - NEW.amount,
          updated_at = now()
      WHERE tenant_id = NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update wallet on payment status change
CREATE TRIGGER update_wallet_on_payment
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_wallet_balance();