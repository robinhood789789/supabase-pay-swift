# Security Features Documentation

This document describes the comprehensive security features implemented in the payment platform.

## 1. Rate Limiting

### Overview
Rate limiting protects against brute force attacks and API abuse by limiting the number of requests from a single IP address or API key.

### Implementation
- **Storage**: Uses the `rate_limits` table in the database
- **Limits**:
  - Auth Sign In: 5 attempts per 15 minutes
  - Auth Sign Up: 3 attempts per hour
  - API Endpoints: 100 requests per minute (default)

### Usage
```typescript
import { checkRateLimit } from '@/lib/security/rateLimit';

const { allowed, remaining, resetAt } = await checkRateLimit(ipAddress, 'auth:signin');
if (!allowed) {
  return res.status(429).json({ error: 'Too many requests' });
}
```

### Database Table
```sql
CREATE TABLE rate_limits (
  id uuid PRIMARY KEY,
  identifier text NOT NULL,  -- IP address or API key
  endpoint text NOT NULL,     -- Endpoint being rate limited
  count integer NOT NULL,     -- Current request count
  window_start timestamptz NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
);
```

## 2. CSRF Protection

### Overview
Cross-Site Request Forgery (CSRF) protection using the double-submit cookie pattern prevents unauthorized commands from being transmitted from a user that the application trusts.

### Implementation
- **Pattern**: Double-submit cookie
- **Storage**: Cookie + localStorage + database
- **Validation**: Both client-side and database verification

### Usage
```typescript
import { getCSRFToken, validateCSRFToken } from '@/lib/security/csrf';

// When making mutations:
const csrfToken = getCSRFToken();
await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
  },
});

// Server-side validation:
const isValid = await validateCSRFToken(token, userId);
```

### Integration
- Automatically initialized on user login via `useCSRF()` hook
- Cleared on logout
- 24-hour token expiration

## 3. Security Headers

### Overview
Security headers protect against common web vulnerabilities and attacks.

### Implemented Headers
- **Content-Security-Policy (CSP)**: Controls resources the browser is allowed to load
- **Strict-Transport-Security (HSTS)**: Forces HTTPS connections
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Controls browser features

### Configuration
Headers are automatically set up on application initialization:
```typescript
import { setupSecurityHeaders } from '@/lib/security/headers';
setupSecurityHeaders();
```

### CSP Configuration
- Allows payment provider iframes (Stripe, OPN, etc.)
- Restricts script sources to trusted domains
- Prevents inline script execution (with exceptions for required libraries)

## 4. Two-Factor Authentication (2FA/TOTP)

### Overview
Time-based One-Time Password (TOTP) authentication adds an extra layer of security to user accounts.

### Features
- Optional for all users
- Can be enforced for specific roles (owner, merchant_admin)
- QR code generation for easy setup
- Backup codes for account recovery
- Compatible with standard authenticator apps (Google Authenticator, Authy, etc.)

### User Flow
1. **Enable 2FA**: User navigates to Settings > Security tab
2. **Scan QR Code**: Display QR code for authenticator app
3. **Verify Setup**: User enters verification code
4. **Save Backup Codes**: 10 backup codes generated for recovery
5. **Enforce for Roles**: Admin can require 2FA for specific roles

### Database Schema
```sql
ALTER TABLE profiles ADD COLUMN
  totp_secret text,
  totp_enabled boolean DEFAULT false,
  totp_backup_codes text[];

ALTER TABLE tenant_settings ADD COLUMN
  enforce_2fa_roles jsonb DEFAULT '[]';
```

### Component Usage
```typescript
import { TwoFactorSetup } from '@/components/security/TwoFactorSetup';

<TwoFactorSetup />
```

## 5. Activity Log

### Overview
Comprehensive audit logging tracks all significant actions within the system for security monitoring and compliance.

### Features
- Filter by action type, actor, and date
- Real-time activity tracking
- IP address and user agent logging
- Before/after state tracking
- Tenant isolation

### Tracked Events
- Payment creation and updates
- Refund requests
- Link creation and modification
- User invitations
- Settings changes
- All CRUD operations on sensitive data

### Database Schema
```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  action text NOT NULL,
  actor_user_id uuid,
  target text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz
);
```

### Component Usage
```typescript
import { ActivityLog } from '@/components/security/ActivityLog';

<ActivityLog tenantId={tenantId} />
```

### Available Filters
- **Action Type**: payment:create, refund:create, user:invite, etc.
- **Date**: Filter by specific date
- **Actor**: Filter by user ID

## Best Practices

### For Developers

1. **Rate Limiting**
   - Always check rate limits before processing sensitive operations
   - Return proper HTTP 429 status codes
   - Include retry-after headers

2. **CSRF Protection**
   - Include CSRF token in all mutation requests
   - Validate tokens server-side
   - Rotate tokens on authentication events

3. **Activity Logging**
   - Log all sensitive operations
   - Include meaningful action names
   - Store before/after states for audit trails

4. **2FA**
   - Never bypass 2FA checks for privileged operations
   - Always verify backup codes server-side
   - Implement account recovery flows

### For Users

1. **Enable 2FA**: Especially for admin and owner accounts
2. **Review Activity Logs**: Regularly check for suspicious activity
3. **Use Strong Passwords**: Combined with 2FA for maximum security
4. **Save Backup Codes**: Store in a secure location

## Security Checklist

- [x] Rate limiting implemented on auth endpoints
- [x] CSRF protection active for all mutations
- [x] Security headers configured
- [x] 2FA available and enforceable by role
- [x] Activity logging with filtering
- [x] Database RLS policies enabled
- [x] Input validation on all forms
- [x] Secure token storage (httpOnly cookies where applicable)
- [x] Encrypted sensitive data at rest

## Emergency Response

### Detected Suspicious Activity
1. Check Activity Log for details
2. Review affected user accounts
3. Force password reset if needed
4. Notify affected users
5. Review and update security policies

### Account Compromise
1. Immediately disable account
2. Force password reset
3. Invalidate all sessions
4. Review activity log for unauthorized actions
5. Notify security team
6. Re-enable with mandatory 2FA

## Compliance Notes

These security features help meet requirements for:
- PCI DSS (Payment Card Industry Data Security Standard)
- GDPR (General Data Protection Regulation)
- SOC 2 Type II compliance
- ISO 27001 information security standards

## Support

For security issues or questions:
- Review this documentation
- Check the Activity Log for suspicious activity
- Contact security team for urgent matters
- Never share credentials or 2FA codes
