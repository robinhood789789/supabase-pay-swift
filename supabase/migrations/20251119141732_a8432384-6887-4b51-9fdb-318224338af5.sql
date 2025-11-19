
-- Step 1: Update existing profiles.share_id to use shareholder user_id instead of referral_code
UPDATE profiles p
SET share_id = s.user_id::text
FROM shareholders s
WHERE p.share_id = s.referral_code
  AND p.share_id IS NOT NULL;

-- Step 2: Update tenants.referred_by_code to use shareholder user_id
UPDATE tenants t
SET referred_by_code = s.user_id::text
FROM shareholders s
WHERE t.referred_by_code = s.referral_code
  AND t.referred_by_code IS NOT NULL;

-- Step 3: Drop ALL triggers related to referral_code (find correct trigger name)
DROP TRIGGER IF EXISTS assign_referral_code_trigger ON shareholders;
DROP TRIGGER IF EXISTS assign_shareholder_referral_code ON shareholders;

-- Step 4: Drop the functions that generate referral_code
DROP FUNCTION IF EXISTS generate_referral_code();
DROP FUNCTION IF EXISTS assign_referral_code();

-- Step 5: Remove referral_code column from shareholders table
ALTER TABLE shareholders DROP COLUMN IF EXISTS referral_code;

-- Step 6: Remove referral_count column (was tied to referral_code)
ALTER TABLE shareholders DROP COLUMN IF EXISTS referral_count;

-- Step 7: Add index on shareholders.user_id for performance
CREATE INDEX IF NOT EXISTS idx_shareholders_user_id ON shareholders(user_id);

-- Step 8: Add comments to document the change
COMMENT ON COLUMN profiles.share_id IS 'Shareholder user_id (UUID) who referred this owner';
COMMENT ON COLUMN tenants.referred_by_code IS 'Shareholder user_id (UUID) who referred this tenant';
