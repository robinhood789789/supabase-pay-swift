# Leaked Password Protection - Setup Guide

## Overview

Leaked Password Protection is a security feature that prevents users from using passwords that have been exposed in known data breaches. This is checked against the HaveIBeenPwned (HIBP) database.

**Status**: Currently disabled (requires manual configuration)

## Why Enable This?

- **Prevents compromised passwords**: Blocks passwords that appear in known data breach databases
- **Compliance**: Required for many security standards (PCI DSS, SOC 2, etc.)
- **User safety**: Protects users from using weak or compromised passwords
- **Best practice**: Recommended by NIST and OWASP guidelines

## How to Enable

### Via Supabase Dashboard

1. **Access your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication Settings**
   - Click on "Authentication" in the left sidebar
   - Click on "Policies" tab
   - Or go directly to: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/auth/policies`

3. **Enable Password Protection**
   - Find "Password Requirements" section
   - Toggle on "Enable HaveIBeenPwned integration"
   - Save changes

### Configuration Options

When enabling leaked password protection, you can configure:

- **Breach threshold**: How many times a password must appear in breaches before blocking it
  - Recommended: 1 (block any password that appears in any breach)
  - Minimum: 1
  - Higher values are less secure

- **Action on detection**:
  - **Block**: Prevent signup/password change (recommended)
  - **Warn**: Allow but show warning (not recommended for production)

## Testing

After enabling, test with known compromised passwords:

```bash
# These are known compromised passwords that should be blocked:
- "password123"
- "qwerty"
- "123456"
```

Try to:
1. Sign up with a compromised password → Should be rejected
2. Change password to a compromised one → Should be rejected
3. Use a strong unique password → Should work

## Monitoring

Monitor rejection rates in:
- Supabase Auth logs
- Your application's error logs
- User support tickets (users may complain about password rejections)

## User Communication

When this feature is enabled, inform users:

```
"For your security, we check passwords against known data breaches. 
If your password has been exposed in a breach, please choose a different one."
```

## Technical Details

- **Service**: HaveIBeenPwned (HIBP) API
- **Privacy**: Only sends first 5 characters of password hash (k-Anonymity)
- **Performance**: Adds ~100-300ms to password validation
- **Availability**: 99.9% uptime (external service)

## Fallback Behavior

If HIBP service is unavailable:
- Default behavior: Allow password (fail open)
- Configure in: Authentication > Policies > Error handling

## Security Impact

**Before enabling**: Passwords can be reused from breaches
**After enabling**: 
- ~1-2% of users may need to choose different passwords
- Significantly reduces account takeover risk
- Improves overall platform security posture

## Related Security Features

After enabling this, also consider:
- ✅ MFA enforcement (already implemented)
- ✅ Password complexity requirements (already implemented)
- ✅ Rate limiting (already implemented)
- ✅ Audit logging (already implemented)

## Support

If you encounter issues:
1. Check Supabase Status: https://status.supabase.com/
2. Review Auth logs in your Supabase dashboard
3. Contact Supabase support: https://supabase.com/support

## References

- [Supabase Password Security Docs](https://supabase.com/docs/guides/auth/password-security)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

---

**Last Updated**: 2025-11-02
**Security Review Status**: Pending - Enable this feature before production deployment