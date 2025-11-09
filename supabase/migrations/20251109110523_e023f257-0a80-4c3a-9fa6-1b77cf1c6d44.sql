-- ข้อ 6: บล็อก anonymous access ต่อตาราง profiles
-- เพิ่ม policy ที่บล็อก anonymous users จากการเข้าถึงข้อมูลใดๆ ในตาราง profiles

-- Drop existing policies if they allow anonymous access
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Create policy that blocks all anonymous access
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure authenticated users can still view their own profile
-- (This policy already exists but we're making it explicit)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Ensure authenticated users can update their own profile
-- (This policy already exists but we're making it explicit)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add policy for super admins to view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_admin(auth.uid()));