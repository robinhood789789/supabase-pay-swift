-- Create the missing update_updated_at function (it's called update_updated_at_column in the DB)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Also create missing function if not exists
CREATE OR REPLACE FUNCTION public.update_platform_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_platform_settings_timestamp
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_platform_settings_updated_at();

-- Add all the triggers
CREATE TRIGGER update_shareholders_updated_at
  BEFORE UPDATE ON public.shareholders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_shareholder_clients_updated_at
  BEFORE UPDATE ON public.shareholder_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER tx_after_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_tx_after_insert();

CREATE TRIGGER tx_after_update
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_tx_after_update();

CREATE TRIGGER update_kyc_documents_updated_at
  BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tenant_kyc_on_document_change
  AFTER INSERT OR UPDATE ON public.kyc_documents
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.update_tenant_kyc_status();

CREATE TRIGGER update_tenant_wallets_updated_at
  BEFORE UPDATE ON public.tenant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_temporary_codes_updated_at
  BEFORE UPDATE ON public.temporary_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_platform_provider_credentials_updated_at
  BEFORE UPDATE ON public.platform_provider_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_platform_security_policy_updated_at
  BEFORE UPDATE ON public.platform_security_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tenant_security_policy_updated_at
  BEFORE UPDATE ON public.tenant_security_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_settlements_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER track_tenant_referral
  BEFORE INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.track_referral_signup();

CREATE TRIGGER assign_shareholder_referral_code
  BEFORE INSERT ON public.shareholders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_referral_code();

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON public.memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role_id ON public.memberships(role_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shareholder_id ON public.transactions(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_shareholders_user_id ON public.shareholders(user_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_clients_shareholder_id ON public.shareholder_clients(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_clients_tenant_id ON public.shareholder_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_earnings_shareholder_id ON public.shareholder_earnings(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_tenant_id ON public.kyc_documents(tenant_id);