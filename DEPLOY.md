# Production Deployment Guide

Complete step-by-step guide for deploying the Payment Platform to production.

## Prerequisites

Before starting deployment, ensure you have:
- [ ] Lovable account with a paid plan (required for custom domains)
- [ ] Supabase/Lovable Cloud project configured
- [ ] Domain name purchased
- [ ] Payment provider account (Stripe, OPN, etc.)
- [ ] Access to your DNS management console

---

## Phase 1: Pre-Deployment Setup

### 1.1 Verify Local Development

```bash
# Test all critical functionality locally
1. Create test payment links
2. Process test payments
3. Verify webhooks receive events
4. Test refund functionality
5. Confirm user authentication works
6. Check API key generation
```

### 1.2 Complete Go-Live Checklist

Navigate to `/go-live` in your application and complete all critical items:

- [ ] Domain & TLS Certificate
- [ ] Production Payment Provider
- [ ] Webhook Endpoints Verified
- [ ] Backup Schedule Configured
- [ ] Admin 2FA Enabled
- [ ] Logging & Alerts Configured
- [ ] Test Transactions Passed

---

## Phase 2: Database & Backend Setup

### 2.1 Lovable Cloud Configuration

Lovable Cloud automatically provides:
- PostgreSQL database (Supabase)
- Edge Functions hosting
- Authentication services
- Storage buckets
- Real-time subscriptions

**No additional configuration needed** - everything is managed through Lovable.

### 2.2 Configure Secrets

Add production secrets via Lovable Cloud dashboard:

1. **Navigate to Settings → Secrets**
2. **Add the following secrets:**
   ```
   # Payment Provider (choose one)
   STRIPE_SECRET_KEY=sk_live_...
   OPN_SECRET_KEY=skey_...
   KBANK_API_KEY=...
   TWOC2P_API_KEY=...
   
   # Webhook signatures (auto-generated)
   WEBHOOK_SECRET=whsec_...
   ```

3. **Verify secrets are set:**
   - Go to Lovable Cloud → View Backend → Edge Functions
   - Check that environment variables are available

### 2.3 Database Migrations

All migrations run automatically through Lovable:

1. **Verify tables exist:**
   - Open Lovable Cloud → View Backend → Database
   - Check for all required tables (tenants, payments, etc.)

2. **Enable RLS policies:**
   ```sql
   -- Already configured automatically
   -- Verify in Table Editor → Security
   ```

3. **Create initial admin user:**
   ```sql
   -- Run in SQL Editor
   INSERT INTO public.profiles (id, email, full_name)
   VALUES (
     'your-user-id-from-auth',
     'admin@yourdomain.com',
     'Admin User'
   );
   ```

### 2.4 Configure Authentication

1. **Set Site URL:**
   - Lovable Cloud → View Backend → Auth Settings
   - Set to your production domain: `https://yourdomain.com`

2. **Add Redirect URLs:**
   ```
   https://yourdomain.com/*
   https://yourdomain.com/auth/callback
   ```

3. **Configure email templates** (optional):
   - Customize confirmation emails
   - Add your branding

4. **Enable 2FA for admins:**
   - Navigate to Settings → Security
   - Enable Two-Factor Authentication
   - Save backup codes securely

---

## Phase 3: Domain & SSL Setup

### 3.1 Configure Custom Domain in Lovable

1. **Open Lovable Project Settings:**
   - Click project name → Settings → Domains

2. **Add your domain:**
   ```
   Primary domain: yourdomain.com
   Subdomain: www.yourdomain.com (optional)
   ```

3. **Note the DNS records provided:**
   ```
   Type: A
   Name: @ (for root domain)
   Value: 185.158.133.1
   
   Type: A
   Name: www (for www subdomain)
   Value: 185.158.133.1
   ```

### 3.2 Update DNS Settings

**At your domain registrar (GoDaddy, Namecheap, etc.):**

1. **Login to DNS management**

2. **Add/Update A Records:**
   ```
   Record Type: A
   Host: @ (or leave blank for root)
   Points to: 185.158.133.1
   TTL: 3600 (or default)
   
   Record Type: A
   Host: www
   Points to: 185.158.133.1
   TTL: 3600
   ```

3. **Remove conflicting records:**
   - Delete old A records pointing elsewhere
   - Remove CNAME records for @ or www
   - Keep only MX records (for email)

4. **Wait for DNS propagation:**
   ```bash
   # Check DNS propagation (can take 5 minutes to 48 hours)
   nslookup yourdomain.com
   
   # Or use online tools:
   # https://dnschecker.org
   ```

### 3.3 Verify SSL Certificate

1. **Wait for Lovable to provision SSL:**
   - Usually takes 5-15 minutes after DNS propagates
   - Lovable automatically issues Let's Encrypt certificate

2. **Verify HTTPS works:**
   ```bash
   curl -I https://yourdomain.com
   # Should return: HTTP/2 200
   ```

3. **Check certificate:**
   - Visit `https://yourdomain.com`
   - Click padlock icon in browser
   - Verify certificate is valid and issued by Let's Encrypt

---

## Phase 4: Payment Provider Configuration

### 4.1 Stripe Setup (if using Stripe)

1. **Switch to live mode** in Stripe Dashboard

2. **Get production API keys:**
   - Dashboard → Developers → API keys
   - Copy **Secret key** (starts with `sk_live_`)
   - Add to Lovable Cloud secrets as `STRIPE_SECRET_KEY`

3. **Configure webhooks:**
   ```
   Endpoint URL: https://yourdomain.com/functions/v1/webhooks-stripe
   
   Events to subscribe:
   - payment_intent.succeeded
   - payment_intent.payment_failed
   - charge.refunded
   - checkout.session.completed
   ```

4. **Copy webhook signing secret:**
   - Starts with `whsec_`
   - Add to secrets as `STRIPE_WEBHOOK_SECRET`

5. **Test webhook:**
   - Go to Settings → Webhooks in your app
   - Click "Send Test" on Stripe webhook
   - Verify event is received

### 4.2 Other Provider Setup

**For OPN (Omise):**
```
1. Get live public & secret keys
2. Add webhook: https://yourdomain.com/functions/v1/webhooks-opn
3. Events: charge.complete, refund.create
```

**For KBank:**
```
1. Request production API credentials
2. Configure callback URL
3. Set up IP whitelist if required
```

**For 2C2P:**
```
1. Get merchant ID and secret key
2. Configure response URL
3. Test 3D Secure flow
```

### 4.3 Test Live Transactions

```bash
# DO NOT use real customer cards for testing

1. Use Stripe test cards in live mode:
   - 4242 4242 4242 4242 (succeeds)
   - 4000 0000 0000 0002 (declines)

2. Process small test amounts ($0.50)

3. Verify:
   - Payment appears in dashboard
   - Webhook received
   - Email notifications sent
   - Database updated correctly

4. Test refund flow:
   - Issue refund
   - Check provider dashboard
   - Verify refund status updates
```

---

## Phase 5: Monitoring & Logging

### 5.1 Enable Database Logging

Already configured by default in Lovable Cloud:
- Query logs
- Error logs
- Connection logs

**View logs:**
- Lovable Cloud → View Backend → Logs

### 5.2 Configure Alerts

**Edge Function Errors:**
```
1. Lovable Cloud → View Backend → Edge Functions
2. Click on function → Logs tab
3. Set up external monitoring (optional):
   - Sentry
   - LogRocket
   - Datadog
```

**Database Alerts:**
```
1. Lovable Cloud → View Backend → Database
2. Settings → Alerts
3. Configure:
   - High CPU usage (>80%)
   - Low disk space (<20%)
   - Connection pool exhausted
```

### 5.3 Health Check Monitoring

**Set up external uptime monitoring:**

```bash
# Use services like:
- UptimeRobot (free)
- Pingdom
- StatusCake

Monitor endpoint:
https://yourdomain.com/functions/v1/health

Expected response (200 OK):
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "storage": { "status": "healthy" }
  }
}
```

**Configure alerts:**
```
- Email when health check fails
- Slack/Discord webhook notifications
- SMS for critical failures
```

### 5.4 Application Monitoring

**Check Activity Logs:**
```
Navigate to: /reports → Activity Log tab

Monitor for:
- Failed login attempts
- Unusual refund patterns
- API key usage spikes
- Suspicious transactions
```

---

## Phase 6: Backup & Recovery

### 6.1 Database Backups

**Lovable Cloud provides automatic backups:**

1. **Point-in-Time Recovery (PITR):**
   - Enabled by default
   - Restore to any point in last 7 days

2. **Manual Backups:**
   ```bash
   # Create backup
   Lovable Cloud → View Backend → Database → Backups
   Click "Create Backup"
   
   # Download backup (if needed)
   Click backup → Download
   ```

3. **Backup Schedule:**
   ```
   Daily: 2 AM UTC
   Weekly: Sunday 2 AM UTC
   Monthly: 1st of month 2 AM UTC
   ```

4. **Verify backups:**
   ```bash
   # Test restore in development
   1. Create test environment
   2. Restore latest backup
   3. Verify data integrity
   ```

### 6.2 Disaster Recovery Plan

**Document recovery procedures:**

```markdown
## Recovery Scenarios

### Scenario 1: Database Corruption
1. Identify last known good backup
2. Create new Supabase project
3. Restore from backup
4. Update connection strings
5. Verify data integrity
6. Switch DNS to new instance

ETA: 2-4 hours

### Scenario 2: Security Breach
1. Immediately revoke all API keys
2. Force password reset for all users
3. Review audit logs
4. Identify compromised data
5. Notify affected users
6. Generate new secrets

ETA: Immediate action required

### Scenario 3: Payment Provider Outage
1. Switch to backup provider (if configured)
2. Display maintenance message
3. Queue failed transactions
4. Retry when service restored

ETA: Depends on provider
```

---

## Phase 7: Security Hardening

### 7.1 Review RLS Policies

```sql
-- Verify all tables have RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- All should show rowsecurity = true

-- Test policies
-- Try accessing data as different users
-- Verify isolation between tenants
```

### 7.2 API Key Rotation

```bash
1. Navigate to Settings → API Keys
2. Create new keys for production
3. Update integrations to use new keys
4. Revoke old development keys
5. Document key rotation schedule (every 90 days)
```

### 7.3 Rate Limiting

Already configured automatically:
- Auth endpoints: 5 attempts per 15 min
- API endpoints: 100 requests per minute

**Monitor rate limit hits:**
```sql
SELECT identifier, endpoint, count, window_start 
FROM public.rate_limits 
WHERE count >= 90
ORDER BY count DESC;
```

### 7.4 Security Audit

Run security scan:
```bash
1. Navigate to /reports → Activity Log
2. Filter by "security" events
3. Review failed auth attempts
4. Check for unusual patterns
```

---

## Phase 8: Final Verification

### 8.1 Pre-Launch Checklist

Complete the checklist at `/go-live`:

- [x] Domain pointing to production
- [x] HTTPS certificate valid
- [x] Production payment provider configured
- [x] Webhooks tested and verified
- [x] Database backups enabled
- [x] All admin accounts have 2FA
- [x] Monitoring and alerts configured
- [x] Test transactions successful
- [x] API keys rotated for production
- [x] Security policies reviewed

### 8.2 Smoke Tests

```bash
# Test critical paths
1. User registration ✓
2. Login with 2FA ✓
3. Create payment link ✓
4. Process payment ✓
5. Receive webhook ✓
6. View payment in dashboard ✓
7. Export payment data ✓
8. Issue refund ✓
9. API key authentication ✓
10. Health check endpoint ✓
```

### 8.3 Performance Baseline

```bash
# Establish performance metrics
curl -w "\nTime: %{time_total}s\n" https://yourdomain.com/functions/v1/health

Target metrics:
- Health check: < 500ms
- Page load: < 2s
- API response: < 1s
- Database query: < 100ms
```

---

## Phase 9: Go Live

### 9.1 Deploy to Production

**Lovable automatically deploys on git push:**

```bash
# Your changes are live immediately after save
# No manual deployment needed

# Verify deployment
curl https://yourdomain.com/functions/v1/health

# Should return 200 with healthy status
```

### 9.2 Monitor First Hours

**Watch for issues:**

```bash
1. Monitor Lovable Cloud logs in real-time
2. Check error rates in dashboard
3. Verify payments processing
4. Watch for webhook failures
5. Monitor database performance
6. Check alert channels

First 24 hours = critical monitoring period
```

### 9.3 Rollback Plan

**If issues arise:**

```bash
1. Identify the problem (logs, alerts)
2. If code issue:
   - Revert to previous working version in Lovable
   - Lovable history → Select previous version
   
3. If database issue:
   - Restore from latest backup
   
4. If payment provider issue:
   - Switch to backup provider
   - Or enable maintenance mode
   
5. Communication:
   - Update status page
   - Notify users via email
   - Post on social media
```

---

## Phase 10: Post-Launch

### 10.1 Performance Monitoring

**Daily checks:**
```bash
- Review error logs
- Check payment success rates
- Monitor API response times
- Verify backup completion
- Review security events
```

**Weekly checks:**
```bash
- Analyze usage patterns
- Review capacity planning
- Check for slow queries
- Update dependencies
- Review user feedback
```

### 10.2 Optimization

**Identify bottlenecks:**
```sql
-- Slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Add indexes where needed
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

**Optimize Edge Functions:**
```typescript
// Add caching
// Reduce database calls
// Use batch operations
```

### 10.3 Documentation

**Update internal docs:**
```
- Deployment procedures (this file)
- API documentation (/docs)
- Runbook for common issues
- Contact information for on-call
- Escalation procedures
```

---

## Troubleshooting

### Domain Not Resolving

```bash
# Check DNS
nslookup yourdomain.com

# Should show: 185.158.133.1

# If not:
1. Verify A records in DNS provider
2. Wait for propagation (up to 48 hours)
3. Clear local DNS cache:
   - Windows: ipconfig /flushdns
   - Mac: sudo dscacheutil -flushcache
   - Linux: sudo systemd-resolve --flush-caches
```

### SSL Certificate Issues

```bash
# If HTTPS not working:
1. Verify DNS is propagated first
2. Check Lovable domain settings
3. Wait 15 minutes for auto-provision
4. Contact Lovable support if > 1 hour

# Check certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### Payment Provider Webhooks Failing

```bash
# Debug webhooks:
1. Check edge function logs
2. Verify webhook URL is correct
3. Test with provider's webhook testing tool
4. Check signature validation
5. Review error messages in logs

# Test locally with ngrok:
ngrok http 8080
# Update webhook URL temporarily to ngrok URL
```

### Database Connection Issues

```bash
# If "too many connections":
1. Check connection pool settings
2. Close idle connections
3. Investigate connection leaks in code

# Monitor connections
SELECT count(*) FROM pg_stat_activity;

# Should be < 100 typically
```

### Performance Degradation

```bash
# If slow response times:
1. Check database CPU/memory
2. Review slow query log
3. Check for missing indexes
4. Review Edge Function logs
5. Monitor network latency

# Quick fixes:
- Add database indexes
- Increase connection pool
- Optimize queries
- Add caching layer
```

---

## Emergency Contacts

```
Lovable Support: support@lovable.dev
Discord: https://discord.gg/lovable

Your Team:
- On-Call Developer: [phone/email]
- Database Admin: [phone/email]
- Security Lead: [phone/email]

External Services:
- Domain Registrar: [support contact]
- Payment Provider: [support contact]
- DNS Provider: [support contact]
```

---

## Checklist Summary

### Pre-Deployment
- [ ] Complete local testing
- [ ] Review code
- [ ] Update secrets
- [ ] Configure webhooks
- [ ] Enable 2FA for admins

### Deployment
- [ ] Configure domain
- [ ] Update DNS
- [ ] Verify SSL
- [ ] Test payment provider
- [ ] Configure monitoring

### Post-Deployment
- [ ] Monitor first 24 hours
- [ ] Verify backups
- [ ] Check health endpoints
- [ ] Review logs
- [ ] Update documentation

---

## Success Criteria

Your deployment is successful when:

✅ Health check returns 200
✅ Domain loads over HTTPS
✅ Test payments process successfully
✅ Webhooks deliver events
✅ Monitoring shows no errors
✅ Backups complete automatically
✅ All admin accounts have 2FA enabled
✅ No security warnings in logs

**Congratulations! You're live in production! 🚀**

---

## Maintenance Schedule

**Daily:**
- Review error logs
- Check payment success rate
- Monitor health checks

**Weekly:**
- Review security logs
- Check backup integrity
- Update dependencies
- Review performance metrics

**Monthly:**
- Rotate API keys
- Security audit
- Capacity planning
- Update documentation
- Team training

**Quarterly:**
- Disaster recovery drill
- Penetration testing
- Compliance review
- Architecture review

---

## Additional Resources

- [Lovable Documentation](https://docs.lovable.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Let's Encrypt SSL Guide](https://letsencrypt.org/docs/)
- [DNS Configuration Guide](https://www.cloudflare.com/learning/dns/what-is-dns/)

---

*Last Updated: 2025-10-09*
*Version: 1.0*
