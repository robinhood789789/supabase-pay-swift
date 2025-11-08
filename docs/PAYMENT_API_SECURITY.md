# Payment API Security Guide

## Overview
All payment-related endpoints implement comprehensive security measures including MFA step-up authentication, input validation, rate limiting, PII protection, and comprehensive audit logging.

## Authentication Methods

### 1. User Authentication (Bearer Token)
- Used for merchant-initiated payments via staff dashboard
- Requires valid JWT token
- Enforces RBAC permissions
- Triggers MFA step-up for sensitive operations

### 2. API Key Authentication
- Used for server-to-server integrations
- Format: `sk_test_xxx` or `sk_live_xxx`
- Hashed storage (SHA-256)
- Tracked usage (`last_used_at`)
- Can be revoked instantly

## MFA Step-Up Enforcement

### Protected Operations
The following actions require MFA step-up verification:

- **create-payment** - Creating checkout sessions (user-initiated)
- **refund** - Processing refunds
- **api-keys** - Creating/revoking API keys
- **webhooks** - Testing webhooks
- **roles** - Modifying user roles
- **payout** - Approving payouts

### Step-Up Window
- Configurable per tenant (default: 300 seconds / 5 minutes)
- Minimum: 120 seconds (2 minutes)
- Maximum: 900 seconds (15 minutes)
- Enforced by `requireStepUp()` guard function

### Response Codes
- `MFA_ENROLL_REQUIRED` - User must enable 2FA first
- `MFA_CHALLENGE_REQUIRED` - Step-up window expired, need re-verification

## Rate Limiting Recommendations

### Critical Endpoints (Strict Limits)
- **POST /api/v1/refunds**: 5 requests/minute per tenant
- **POST /api/keys:create**: 10 requests/minute per tenant
- **POST /api/keys:revoke**: 10 requests/minute per tenant

### Standard Endpoints
- **POST /api/v1/checkout/sessions**: 10 requests/minute per tenant
- **GET /api/v1/checkout/sessions/:id**: 30 requests/minute per tenant

### Public Endpoints
- **POST /api/v1/links/:slug/checkout**: 3 requests/minute per IP
- **GET /api/v1/links/:slug**: 10 requests/minute per IP

## Input Validation

### Amount Validation
- Type: positive number
- Minimum: > 0
- Maximum: 10,000,000 cents (100K USD/EUR or 10M THB)
- Prevents integer overflow attacks

### Currency Validation
- Supported: USD, THB, EUR, GBP, JPY, SGD
- Must be uppercase 3-letter ISO code
- Validated against whitelist

### Reference Validation
- Maximum length: 255 characters
- Sanitized: removes `<>` characters
- Optional field

### URL Validation
- Must use http:// or https:// protocol
- TLS-only enforced in production
- Prevents open redirect vulnerabilities

## Data Protection

### PII Redaction
All logging follows these rules:

```typescript
// ✅ GOOD - No PII
console.log(`[Checkout] Creating session for tenant ${tenantId}, amount: ${amount} ${currency}`);

// ❌ BAD - Contains PII
console.log(`Creating session for ${customerEmail} with card ${cardLast4}`);
```

### Never Store
- Full credit card numbers (PAN)
- CVV/CVC codes
- Unencrypted passwords
- Full IP addresses (partial only for fraud detection)

### Audit Logging
All sensitive operations are logged to `audit_logs` table with:
- `actor_user_id` - Who performed the action
- `action` - What was done
- `target` - What was affected
- `before`/`after` - State changes (no PII)
- `ip` - Partial IP (first 15 chars)
- `user_agent` - Truncated to 255 chars

## Idempotency

### Usage
Clients can provide `Idempotency-Key` header for safe retries:

```http
POST /api/v1/checkout/sessions
Idempotency-Key: unique_key_12345
X-Tenant: tenant_uuid
Authorization: Bearer token
```

### Behavior
- Cached responses for 24 hours
- Prevents duplicate charges
- Per-tenant isolation
- Automatic cleanup after expiry

## TLS and Transport Security

### Requirements
- TLS 1.2+ only in production
- Valid SSL certificates required
- HSTS headers recommended
- Secure webhooks (HTTPS only)

### Webhook Security
- Signature verification required
- Replay attack prevention (timestamp checks)
- IP whitelist support
- Retry with exponential backoff

## Error Handling

### Secure Error Responses
Errors never expose:
- Stack traces in production
- Internal database errors
- Provider-specific error details
- System configuration

### Standard Error Format
```json
{
  "error": "Failed to create checkout session",
  "code": "INVALID_AMOUNT"
}
```

### Logging
- Detailed errors logged server-side only
- Client receives generic messages
- Correlation IDs for debugging

## Compliance

### PCI DSS
- No card data storage
- Provider-hosted payment pages
- Tokenization for recurring payments
- Secure transmission (TLS)

### GDPR
- Right to erasure supported
- Data minimization enforced
- Audit trail retention
- Privacy by design

## Security Checklist

### Before Production
- [ ] Enable rate limiting at infrastructure level
- [ ] Configure leaked password protection
- [ ] Enable MFA for all privileged users
- [ ] Review and test RLS policies
- [ ] Set up monitoring and alerting
- [ ] Configure webhook signature verification
- [ ] Review audit log retention policies
- [ ] Test disaster recovery procedures
- [ ] Conduct security scan
- [ ] Document incident response plan

### Regular Maintenance
- [ ] Review API key usage monthly
- [ ] Audit role permissions quarterly
- [ ] Update dependencies regularly
- [ ] Review security logs weekly
- [ ] Test backup restoration quarterly
- [ ] Conduct penetration testing annually

## Incident Response

### Suspected Breach
1. Immediately revoke compromised API keys
2. Force MFA re-verification for affected accounts
3. Review audit logs for suspicious activity
4. Notify affected users within 72 hours (GDPR)
5. Document incident and remediation steps

### API Key Leak
1. Revoke key immediately via admin dashboard
2. Generate new key for legitimate usage
3. Review all transactions made with leaked key
4. Update applications with new key
5. Implement additional monitoring

## Support

For security concerns:
- **Critical**: security@yourplatform.com (24/7)
- **Non-critical**: support@yourplatform.com
- **Bug bounty**: Responsible disclosure policy

## Version History
- v1.0.0 (2025-10-22): Initial security implementation with MFA step-up
