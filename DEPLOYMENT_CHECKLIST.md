# 🚀 PRODUCTION DEPLOYMENT CHECKLIST

## Database Setup ✅
- [x] All migrations applied and verified
- [x] RLS policies active on all tables
- [x] Audit logs configured (WORM-style)
- [x] Database functions created
- [ ] **CRITICAL**: Create advisory lock RPC functions (see below)

### Advisory Lock Functions (Required for Concurrency)
```sql
-- Add these to a migration
CREATE OR REPLACE FUNCTION pg_try_advisory_lock(lock_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN pg_try_advisory_lock($1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION pg_advisory_unlock(lock_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN pg_advisory_unlock($1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Edge Functions ✅
- [x] All edge functions deployed
- [x] MFA guards implemented
- [x] Rate limiting active
- [x] Error redaction configured
- [x] CORS headers set

## Security Configuration ✅
- [x] Secrets configured (RESEND_API_KEY)
- [x] Auto-confirm email enabled for non-production
- [x] Platform security policy table populated
- [x] Tenant security policies with defaults
- [x] 2FA enforcement configured
- [x] Step-up MFA on sensitive actions

## Monitoring & Alerts ✅
- [x] Alert rules configured
- [x] Alert channels setup (email + webhook)
- [x] Audit log retention policy
- [ ] Webhook DLQ monitoring dashboard (recommended)
- [ ] Production Redis for rate limiting (optional upgrade)

## Payment Provider Integration
- [ ] Provider credentials configured per tenant
- [ ] Webhook secrets set
- [ ] Webhook endpoints registered with providers
- [ ] Test transactions completed
- [ ] Refund flow tested
- [ ] Reconciliation tested with sample statements

## Go-Live Verification
- [ ] Complete interactive checklist at `/go-live/controls`
- [ ] Run gap analysis at `/reports/gap`
- [ ] Review all test scenarios (pass status)
- [ ] Verify Super Admin can provision tenants
- [ ] Verify Owner can manage admins
- [ ] Verify Admin permissions enforced
- [ ] Verify MFA prompts appear correctly
- [ ] Verify audit logs capture all actions

## Documentation ✅
- [x] Pyramid Authority model documented
- [x] API documentation generated
- [x] Security features documented
- [x] MFA setup guide created
- [x] Tenant permissions guide
- [x] Payment endpoints documented

## Performance & Scalability
- [ ] Database indexes reviewed
- [ ] Connection pooling configured
- [ ] Rate limiting thresholds set appropriately
- [ ] Large export limits configured
- [ ] Webhook retry backoff tested

## Compliance & Data Protection
- [x] PII redaction in logs
- [x] Audit trail completeness verified
- [x] Data retention policies set
- [x] Export checksums implemented
- [ ] GDPR/data protection compliance review
- [ ] Privacy policy updated

## Backup & Recovery
- [ ] Database backup schedule configured
- [ ] Backup restoration tested
- [ ] Disaster recovery plan documented
- [ ] Rollback procedures documented

## User Acceptance Testing
- [ ] Super Admin flows tested end-to-end
- [ ] Owner flows tested end-to-end
- [ ] Admin flows tested with restrictions
- [ ] Payment flows tested (create, refund, settle)
- [ ] Webhook flows tested (success, failure, retry)
- [ ] Alert flows tested (trigger, ack, resolve)
- [ ] Reconciliation tested with real data

## Post-Launch Monitoring
- [ ] Monitor edge function logs for errors
- [ ] Monitor webhook DLQ for failures
- [ ] Monitor rate limiting rejections
- [ ] Monitor MFA challenge success rates
- [ ] Monitor audit log volume
- [ ] Monitor payment success/failure rates

## Sign-Off
- [ ] Technical Lead Review
- [ ] Security Team Review
- [ ] Product Owner Approval
- [ ] Compliance Review (if applicable)

---

## Quick Fixes for Common Issues

### Issue: Advisory locks not working
**Fix**: Run the SQL migration above to create RPC functions

### Issue: Rate limiting too aggressive
**Fix**: Adjust thresholds in `_shared/concurrency.ts` and redeploy

### Issue: Webhooks not processing
**Check**: 
1. Webhook secrets configured correctly
2. Provider webhook URLs point to correct edge functions
3. Check webhook_events table for errors

### Issue: MFA prompts not appearing
**Check**:
1. Tenant security policy `require_2fa_for_*` flags
2. User profile `totp_enabled` flag
3. `mfa_last_verified_at` timestamp vs step-up window

### Issue: Audit logs missing details
**Check**:
1. Edge functions include IP/UA in request
2. Request ID passed through all calls
3. Before/after objects populated correctly

---

## Support Contacts

**Technical Issues**: [Your DevOps Team]
**Security Issues**: [Your Security Team]
**Payment Issues**: [Your Finance Team]

Last Updated: 2025-10-22
