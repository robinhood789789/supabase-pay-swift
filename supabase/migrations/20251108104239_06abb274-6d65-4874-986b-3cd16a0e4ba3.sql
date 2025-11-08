-- Add missing MFA columns to profiles and allow users to update their own MFA fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS totp_secret text,
  ADD COLUMN IF NOT EXISTS totp_backup_codes text[];

-- Ensure RLS allows users to update their own MFA-related fields
-- (Adds a safe, user-scoped UPDATE policy if none exists for self-updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Users can update their own profile (MFA fields)'
  ) THEN
    CREATE POLICY "Users can update their own profile (MFA fields)"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;