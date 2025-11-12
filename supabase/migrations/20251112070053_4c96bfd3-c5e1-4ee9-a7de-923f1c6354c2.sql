-- Create customer_bank_accounts table
CREATE TABLE IF NOT EXISTS public.customer_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code TEXT NOT NULL,
  bank_short_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_holder TEXT,
  account_number TEXT NOT NULL,
  notes TEXT,
  password_visible BOOLEAN DEFAULT false,
  deposit_enabled BOOLEAN DEFAULT true,
  withdrawal_enabled BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage customer bank accounts"
ON public.customer_bank_accounts
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_customer_bank_accounts_bank_code ON public.customer_bank_accounts(bank_code);
CREATE INDEX idx_customer_bank_accounts_status ON public.customer_bank_accounts(status);

-- Add trigger for updated_at
CREATE TRIGGER update_customer_bank_accounts_updated_at
BEFORE UPDATE ON public.customer_bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Insert sample data
INSERT INTO public.customer_bank_accounts (bank_code, bank_short_name, bank_name, account_holder, account_number, notes, deposit_enabled, withdrawal_enabled, status) VALUES
('GSB', 'GSB-01', 'ธนาคารออมสิน', 'มงคลชัย ลุกระโทก', '020457702528', NULL, false, false, 'offline'),
('GSB', 'GSB-02', 'ธนาคารออมสิน', 'รัฐสาลอร์ กองคำ', '020417445085', NULL, true, false, 'online'),
('GSB', 'GSB-03', 'ธนาคารออมสิน', 'ศรัณย์วัช จันทร์กัญญา', '020451051526', NULL, true, false, 'online'),
('KBANK', 'KBANK-01', 'กสิกรไทย', NULL, '1234567890', 'ปิดยูสิอนอย่างถือนต้องซื้อปีค่า 1 ปียูสิ', false, true, 'offline'),
('KTB', 'KTB-01', 'ธนาคารกรุงไทย', 'นพมาส กามหอง', '7860619032', NULL, true, false, 'online'),
('TTB', 'TTB-01', 'ทหารไทยธนชาติ', 'ณัฐฤกษ์ ทิพย์เสลา', '9242250497', NULL, false, false, 'offline');