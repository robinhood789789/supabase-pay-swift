-- Create shareholder invitations table
CREATE TABLE IF NOT EXISTS public.shareholder_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id uuid NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  email text NOT NULL,
  magic_token text NOT NULL UNIQUE,
  temp_password_hash text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  resent_count integer NOT NULL DEFAULT 0,
  last_resent_at timestamptz,
  invalidated_at timestamptz,
  invalidation_reason text
);

-- Add index for fast lookup
CREATE INDEX idx_shareholder_invitations_token ON public.shareholder_invitations(magic_token) WHERE used_at IS NULL AND invalidated_at IS NULL;
CREATE INDEX idx_shareholder_invitations_shareholder ON public.shareholder_invitations(shareholder_id);
CREATE INDEX idx_shareholder_invitations_expires ON public.shareholder_invitations(expires_at) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE public.shareholder_invitations ENABLE ROW LEVEL SECURITY;

-- Super admins can manage invitations
CREATE POLICY "Super admins can manage shareholder invitations"
ON public.shareholder_invitations
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Add first login tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS requires_password_change boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
ADD COLUMN IF NOT EXISTS first_login_completed_at timestamptz;

-- Create audit log entries for invitation actions
COMMENT ON TABLE public.shareholder_invitations IS 'Tracks magic link invitations for shareholder accounts with temporary passwords';