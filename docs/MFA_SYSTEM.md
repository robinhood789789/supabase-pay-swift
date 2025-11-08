# Multi-Factor Authentication (MFA) System

## Overview

This application implements Google Authenticator-compatible TOTP (Time-based One-Time Password) 2FA with role-based enforcement and step-up authentication.

## Key Features

### 1. **TOTP-Based 2FA**
- Google Authenticator, Authy, or any TOTP-compatible app
- QR code enrollment with manual code fallback
- 6-digit codes with 30-second rotation
- Recovery codes (10 per user, one-time use)

### 2. **Role-Based Enforcement**
Controlled via `tenant_security_policy` table:
- **Super Admin**: Always requires MFA (platform policy)
- **Owner**: Configurable per tenant (default: required)
- **Admin**: Configurable per tenant (default: required)
- **Other roles**: Optional MFA

### 3. **Step-Up Authentication**
- MFA challenges expire after `stepup_window_seconds` (default: 300 seconds)
- Users are prompted to re-verify for dangerous actions
- Last verification tracked in `profiles.mfa_last_verified_at`

## Database Schema

### `profiles` table additions:
```sql
- totp_enabled: boolean
- totp_secret: text (encrypted)
- totp_backup_codes: text[] (hashed)
- mfa_last_verified_at: timestamptz
```

### `tenant_security_policy` table:
```sql
- tenant_id: uuid (PK, FK to tenants)
- require_2fa_for_owner: boolean (default: true)
- require_2fa_for_admin: boolean (default: true)
- stepup_window_seconds: integer (default: 300)
```

## User Flows

### Enrollment Flow
1. User navigates to `/settings` → Security tab
2. Clicks "Enable Two-Factor Authentication"
3. System generates TOTP secret and recovery codes
4. QR code displayed for scanning
5. User enters 6-digit code to verify
6. Recovery codes shown once (can copy/download/print)
7. Profile updated with `totp_enabled=true`

### Login Flow
1. User enters email/password
2. System checks:
   - Is user super admin? → MFA required
   - Is user owner/admin? → Check tenant policy
3. If MFA required but not enrolled:
   - Redirect to `/settings` (security tab)
   - Show toast: "Please enable 2FA. It is required for your role."
4. If MFA enrolled:
   - Redirect to `/auth/mfa-challenge`
   - Prompt for 6-digit code or recovery code
5. On success:
   - Update `mfa_last_verified_at`
   - Continue to dashboard

### Protected Page Flow (useMfaGuard)
Pages can enforce MFA using `useMfaGuard({ required: true })`:
1. Hook checks if MFA is required for user's role
2. If required but not enrolled → redirect to settings
3. If enrolled but `mfa_last_verified_at` expired → redirect to challenge
4. Otherwise, allow access

### Dangerous Action Flow (use2FAChallenge)
For sensitive operations (e.g., creating users, changing settings):
1. Call `checkAndChallenge(() => performAction())`
2. If MFA not enabled or recently verified (within stepup window) → proceed
3. Otherwise → show 2FA challenge dialog
4. On success → execute pending action

## Components

### Pages
- `/auth/mfa-challenge` - Minimal MFA verification page
- `/settings` - Security tab with TwoFactorSetup component

### Components
- `TwoFactorSetup` - Enrollment, management, recovery code regeneration
- `TwoFactorChallenge` - Inline dialog for dangerous actions
- `ProtectedRoute` - Wrapper for authenticated routes

### Hooks
- `useMfaGuard({ required })` - Enforce MFA on protected pages
- `use2FAChallenge()` - Challenge flow for dangerous actions
- `useAuth()` - Enhanced with MFA checks in signIn

## API Integration

### TOTP Functions (`src/lib/security/totp.ts`)
```typescript
generateTOTPSecret() // Create 20-byte secret, base32-encoded
generateBackupCodes(count = 10) // Generate one-time recovery codes
getTOTPQRCodeUrl(secret, email, issuer) // otpauth:// URI
verifyTOTP(secret, token) // Verify 6-digit code with ±1 time window
```

### Recovery Code Management
- Stored hashed in `profiles.totp_backup_codes`
- One-time use (removed after verification)
- Can be regenerated (invalidates previous codes)

## Security Considerations

### Storage
- TOTP secrets should be encrypted at rest (Supabase handles this)
- Recovery codes hashed before storage
- MFA verification state in `mfa_last_verified_at`

### Policies
- Super admins ALWAYS require MFA
- Tenant owners should require MFA (business critical)
- Stepup window prevents constant re-verification

### Best Practices
1. **Enforce enrollment**: Don't allow privileged users without MFA
2. **Short stepup windows**: 5 minutes (300s) for dangerous actions
3. **Recovery codes**: Encourage users to save securely
4. **Rate limiting**: Protect MFA endpoints from brute force

## Example Usage

### Enforce MFA on a Page
```typescript
import { useMfaGuard } from '@/hooks/useMfaGuard';

function AdminPage() {
  useMfaGuard({ required: true });
  
  return <div>Protected Content</div>;
}
```

### Challenge Before Dangerous Action
```typescript
import { use2FAChallenge } from '@/hooks/use2FAChallenge';
import { TwoFactorChallenge } from '@/components/security/TwoFactorChallenge';

function DeleteButton() {
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  
  const handleDelete = async () => {
    await checkAndChallenge(async () => {
      // Perform dangerous action
      await deleteResource();
    });
  };
  
  return (
    <>
      <Button onClick={handleDelete}>Delete</Button>
      <TwoFactorChallenge
        open={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}
```

## Configuration

### Per-Tenant Policy
Owners can configure MFA requirements:
```typescript
await supabase
  .from('tenant_security_policy')
  .upsert({
    tenant_id: tenantId,
    require_2fa_for_owner: true,
    require_2fa_for_admin: true,
    stepup_window_seconds: 300
  });
```

### Platform Policy (Super Admin)
Hard-coded in `useAuth` and `useMfaGuard`:
- Super admins always require MFA
- Cannot be disabled

## Troubleshooting

### User can't enroll
- Check `profiles` table has required columns
- Verify QR code generation works
- Check browser console for errors

### Login redirects to settings
- User's role requires MFA but not enrolled
- Solution: Complete enrollment in security settings

### Constant re-verification
- `stepup_window_seconds` too short
- `mfa_last_verified_at` not updating correctly
- Check database triggers and updates

### Recovery codes don't work
- Codes are one-time use (removed after verification)
- User may need to regenerate codes
- Check format (with/without hyphens)

## Future Enhancements

1. **SMS/Email Backup**: Alternative to recovery codes
2. **WebAuthn**: Hardware keys (YubiKey, etc.)
3. **Admin Override**: Super admin can reset user MFA
4. **Audit Log**: Track MFA enrollment/verification events
5. **Device Trust**: Remember devices for X days
