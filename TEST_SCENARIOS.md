# 🧪 AUTOMATED TEST SCENARIOS

This document outlines comprehensive test scenarios for the Pyramid Authority payment gateway. These tests validate security, permissions, audit trails, and business logic.

## Super Admin Scenarios

### SA-1: Tenant Provisioning Flow
**Objective**: Verify Super Admin can create a new tenant with Owner account

**Steps**:
1. Navigate to `/admin/provision-merchant`
2. Fill in business details (name, email, tax_id, etc.)
3. Submit form
4. Verify tenant created in `tenants` table
5. Verify Owner user created in `profiles` table
6. Verify membership created with 'owner' role
7. Verify temp password generated and force_password_change flag set
8. Verify welcome email sent (check email logs)
9. Verify audit log entry created with all details

**Expected Results**:
- ✅ Tenant status = 'active'
- ✅ Owner user has temp password
- ✅ force_password_change = true
- ✅ require_2fa = true
- ✅ Audit log shows 'tenant_provision' action with IP/UA/request_id
- ✅ Admin activity logged

**Auto-Verify**:
```sql
-- Check tenant
SELECT * FROM tenants WHERE name = 'Test Merchant' AND status = 'active';

-- Check owner user
SELECT p.*, m.role_id 
FROM profiles p
JOIN memberships m ON p.id = m.user_id
WHERE p.email = 'owner@testmerchant.com';

-- Check audit
SELECT * FROM audit_logs 
WHERE action = 'tenant_provision' 
ORDER BY created_at DESC LIMIT 1;
```

### SA-2: Global Refund Freeze
**Objective**: Verify Super Admin can toggle global refund freeze and it blocks tenant refunds

**Steps**:
1. Navigate to `/admin/platform-security`
2. Enable "Global Refund Freeze"
3. Switch to Owner account
4. Attempt to create a refund
5. Verify refund blocked with clear message
6. Switch back to Super Admin
7. Disable "Global Refund Freeze"
8. Attempt refund again as Owner
9. Verify refund succeeds (with approval if guardrail exists)

**Expected Results**:
- ✅ Platform security policy updated
- ✅ Refund blocked with message: "Refunds are currently frozen by platform administrator"
- ✅ Audit log shows both freeze enable and disable
- ✅ Refund succeeds after unfreeze

**Auto-Verify**:
```sql
-- Check policy
SELECT * FROM platform_security_policy;

-- Check blocked refund attempt in audit
SELECT * FROM audit_logs 
WHERE action = 'refund_blocked_global_freeze'
ORDER BY created_at DESC LIMIT 1;
```

### SA-3: Cross-Tenant Audit Access
**Objective**: Verify Super Admin can view audit logs across all tenants

**Steps**:
1. Navigate to `/admin/platform-audit`
2. Verify can see logs from multiple tenants
3. Filter by specific tenant
4. Filter by action type
5. Export audit logs to CSV
6. Verify checksum generated

**Expected Results**:
- ✅ All tenant logs visible
- ✅ Filters work correctly
- ✅ Export includes SHA-256 checksum
- ✅ Export action logged to audit

## Owner Scenarios

### OW-1: Admin Invitation with Role Assignment
**Objective**: Verify Owner can invite admins and assign role templates

**Steps**:
1. Navigate to `/admin/users`
2. Click "Invite User"
3. Enter email, select "Finance" role template
4. Enable "Force 2FA on First Login"
5. Submit
6. Verify user created with temp password
7. Verify role assigned with correct permissions
8. Verify invitation email sent
9. Verify role_assignments_log entry created

**Expected Results**:
- ✅ User created with membership
- ✅ Role = 'finance' with correct permissions
- ✅ force_2fa = true
- ✅ Temp password set
- ✅ Invitation email sent
- ✅ Audit log + role_assignments_log entries

**Auto-Verify**:
```sql
-- Check membership
SELECT m.*, r.name as role_name
FROM memberships m
JOIN roles r ON m.role_id = r.id
WHERE m.user_id = (SELECT id FROM profiles WHERE email = 'finance@tenant.com');

-- Check role assignment log
SELECT * FROM role_assignments_log
WHERE action = 'assign_role'
ORDER BY created_at DESC LIMIT 1;
```

### OW-2: Guardrail Configuration
**Objective**: Verify Owner can configure guardrails that trigger approvals

**Steps**:
1. Navigate to `/settings` → Guardrails tab
2. Create rule: "Refunds > 1,000 THB require approval"
3. Save rule
4. Switch to Admin account
5. Attempt refund of 2,000 THB
6. Verify approval required (blocked)
7. Switch back to Owner
8. Navigate to `/approvals`
9. Approve refund with MFA
10. Verify refund executes

**Expected Results**:
- ✅ Guardrail created in `guardrails` table
- ✅ Refund blocked with clear message
- ✅ Approval created in `approvals` table
- ✅ Owner can approve with MFA
- ✅ Refund executes after approval
- ✅ Audit log shows block, approval, and execution

**Auto-Verify**:
```sql
-- Check guardrail
SELECT * FROM guardrails 
WHERE rule_type = 'refund_amount_limit' 
AND enabled = true;

-- Check approval flow
SELECT * FROM approvals 
WHERE action_type = 'refund_create'
ORDER BY created_at DESC LIMIT 1;

-- Check refund created
SELECT * FROM refunds
ORDER BY created_at DESC LIMIT 1;
```

### OW-3: Activity Monitoring
**Objective**: Verify Owner can see admin activity with full context

**Steps**:
1. Have Admin A create 3 payment links
2. Navigate to `/activity-history` as Owner
3. Verify can see all 3 actions
4. Verify each action shows:
   - Actor (Admin A)
   - IP address
   - User agent
   - Request ID
   - Timestamp
   - Before/after state

**Expected Results**:
- ✅ All 3 payment link creations visible
- ✅ IP address captured (truncated for privacy)
- ✅ User agent captured
- ✅ Request ID unique per action
- ✅ Before = null, after = {link details}

**Auto-Verify**:
```sql
-- Check activity logs
SELECT 
  al.*,
  p.email as actor_email
FROM audit_logs al
JOIN profiles p ON al.actor_user_id = p.id
WHERE al.action = 'payment_link_create'
  AND al.ip IS NOT NULL
  AND al.user_agent IS NOT NULL
ORDER BY al.created_at DESC
LIMIT 3;
```

## Admin Scenarios

### AD-1: Large Export with MFA
**Objective**: Verify large exports require step-up MFA and generate checksums

**Steps**:
1. Navigate to `/payments`
2. Click "Export" with >50k rows selected
3. Verify MFA challenge appears
4. Complete MFA
5. Verify export downloads
6. Verify checksum included
7. Verify audit log entry

**Expected Results**:
- ✅ MFA challenge required
- ✅ Export file downloaded
- ✅ SHA-256 checksum in response header or file
- ✅ Audit log shows 'payments_export_large' with checksum
- ✅ Rate limit not exceeded

**Auto-Verify**:
```sql
-- Check audit
SELECT * FROM audit_logs
WHERE action = 'payments_export_large'
  AND after->>'checksum' IS NOT NULL
ORDER BY created_at DESC LIMIT 1;
```

### AD-2: Off-Hours API Key Block
**Objective**: Verify guardrails block API key creation outside business hours

**Steps**:
1. Configure guardrail: "API key operations only 9-5 weekdays"
2. Attempt to create API key at 8pm
3. Verify blocked with clear message
4. Verify audit log entry
5. Attempt at 10am next day
6. Verify succeeds

**Expected Results**:
- ✅ Off-hours attempt blocked
- ✅ Message: "API key operations are only allowed during business hours (9-5 weekdays)"
- ✅ Audit log shows 'api_key_blocked_hours'
- ✅ During-hours attempt succeeds

**Auto-Verify**:
```sql
-- Check guardrail
SELECT * FROM guardrails
WHERE rule_type = 'business_hours'
  AND rule_config->>'resource' = 'api_keys';

-- Check blocked attempt
SELECT * FROM audit_logs
WHERE action = 'api_key_blocked_hours'
ORDER BY created_at DESC LIMIT 1;
```

### AD-3: Permission-Based UI Hiding
**Objective**: Verify UI hides actions not allowed by permissions

**Steps**:
1. Create Admin with "Viewer" role (read-only)
2. Login as viewer
3. Navigate to `/payments`
4. Verify "Refund" button not visible
5. Navigate to `/admin/users`
6. Verify "Invite User" button not visible
7. Verify "My Activity" panel shows only view actions

**Expected Results**:
- ✅ Refund button hidden
- ✅ Invite button hidden
- ✅ Activity panel shows only SELECT operations
- ✅ Tooltips explain missing permissions

**Manual Verification Required** (UI-based)

## Webhook Scenarios

### WH-1: Idempotent Processing
**Objective**: Verify webhooks are processed exactly once

**Steps**:
1. Send `checkout.session.completed` webhook
2. Verify event processed (payment created)
3. Send same webhook again (replay)
4. Verify event not processed again (idempotent)
5. Check `provider_events` table
6. Verify only one entry exists

**Expected Results**:
- ✅ First webhook creates payment
- ✅ Replay webhook returns 200 but doesn't duplicate
- ✅ Only one `provider_events` entry
- ✅ Audit log shows both attempts, second marked as 'duplicate'

**Auto-Verify**:
```sql
-- Check provider events
SELECT COUNT(*) as event_count
FROM provider_events
WHERE event_id = 'evt_test_123';
-- Should return 1

-- Check payments
SELECT COUNT(*) as payment_count
FROM payments
WHERE provider_payment_id = 'pi_test_123';
-- Should return 1
```

### WH-2: Signature Verification
**Objective**: Verify invalid webhook signatures are rejected

**Steps**:
1. Send webhook with invalid signature
2. Verify 401 Unauthorized response
3. Verify audit log shows 'webhook_signature_invalid'
4. Send webhook with valid signature
5. Verify 200 OK response
6. Verify event processed

**Expected Results**:
- ✅ Invalid signature rejected
- ✅ Valid signature accepted
- ✅ Audit log captures both attempts
- ✅ No payment created for invalid signature

**Auto-Verify**:
```sql
-- Check rejected webhook
SELECT * FROM audit_logs
WHERE action = 'webhook_signature_invalid'
  AND target LIKE '%stripe%'
ORDER BY created_at DESC LIMIT 1;
```

### WH-3: Retry and DLQ
**Objective**: Verify failed webhooks retry with backoff and move to DLQ

**Steps**:
1. Configure tenant webhook to unreachable URL
2. Trigger webhook event
3. Verify retry attempts (up to 5)
4. Verify exponential backoff (1s, 2s, 4s, 8s, 16s)
5. Verify moved to DLQ after max attempts
6. Verify audit log entries for each attempt

**Expected Results**:
- ✅ 5 retry attempts
- ✅ Backoff delays increase exponentially
- ✅ Status = 'failed' after max attempts
- ✅ DLQ query returns failed event
- ✅ Audit log shows all attempts with timestamps

**Auto-Verify**:
```sql
-- Check webhook event
SELECT * FROM webhook_events
WHERE status = 'failed'
  AND attempts >= 5
ORDER BY created_at DESC LIMIT 1;

-- Check DLQ
SELECT 
  id,
  webhook_id,
  retry_count,
  last_error,
  created_at
FROM webhook_events
WHERE status = 'failed'
  AND retry_count >= 5;
```

## Alert Scenarios

### AL-1: Export Outside Hours Alert
**Objective**: Verify alerts trigger on exports outside business hours

**Steps**:
1. Configure alert rule: "Export outside hours"
2. Perform export at 10pm
3. Verify alert created
4. Verify alert_event created
5. Verify notification sent (email/webhook)
6. Navigate to `/alert-management`
7. Acknowledge alert with MFA
8. Close alert with notes

**Expected Results**:
- ✅ Alert created with severity='warning'
- ✅ Alert_event created with details
- ✅ Notification sent
- ✅ Owner can ack/close with MFA
- ✅ Audit log shows ack and close actions

**Auto-Verify**:
```sql
-- Check alert
SELECT * FROM alerts
WHERE alert_type = 'export_outside_hours'
  AND resolved = false
ORDER BY created_at DESC LIMIT 1;

-- Check alert events
SELECT * FROM alert_events
WHERE alert_id = (
  SELECT id FROM alerts 
  WHERE alert_type = 'export_outside_hours'
  ORDER BY created_at DESC LIMIT 1
);
```

### AL-2: High Refund Rate Alert
**Objective**: Verify alerts trigger on high refund rate by single admin

**Steps**:
1. Configure alert rule: "Refunds > 5/hour by single admin"
2. Have Admin create 6 refunds in 1 hour
3. Verify alert triggered
4. Verify incident details show admin email, count, timeframe
5. Verify Owner receives notification
6. Owner reviews and adds notes
7. Close alert

**Expected Results**:
- ✅ Alert triggered after 6th refund
- ✅ Alert metadata includes admin_id, count=6, window='1 hour'
- ✅ Notification sent to Owner
- ✅ Owner can add investigation notes
- ✅ All actions logged

**Auto-Verify**:
```sql
-- Check alert
SELECT * FROM alerts
WHERE alert_type = 'refund_rate_high'
  AND metadata->>'admin_id' = 'admin_user_id'
ORDER BY created_at DESC LIMIT 1;
```

## Reconciliation Scenarios

### RC-1: Statement Upload and Matching
**Objective**: Verify CSV upload matches payments with fuzzy logic

**Steps**:
1. Navigate to `/reconciliation`
2. Upload CSV with 100 transactions
3. Configure: provider=stripe, amount_tolerance=50, date_window=2
4. Submit with MFA
5. Verify matching results:
   - Exact matches (score >= 90)
   - Partial matches (score 50-89)
   - Unmatched (score < 50)
6. Review discrepancy report
7. Export report with checksum

**Expected Results**:
- ✅ MFA required before upload
- ✅ Rate limit enforced (3 uploads per 5 min)
- ✅ Matching results categorized by score
- ✅ Settlement record created for matches
- ✅ Discrepancy report available
- ✅ Audit log captures full reconciliation details
- ✅ Export includes SHA-256 checksum

**Auto-Verify**:
```sql
-- Check settlement
SELECT * FROM settlements
WHERE provider = 'stripe'
ORDER BY created_at DESC LIMIT 1;

-- Check reconciled payments
SELECT COUNT(*) FROM payments
WHERE reconciliation_status = 'matched'
  AND reconciled_at > NOW() - INTERVAL '1 hour';
```

---

## Test Execution Plan

### Phase 1: Automated Database Tests
Run SQL queries to verify data integrity and RLS policies.

### Phase 2: API Integration Tests
Use edge function testing to verify:
- MFA enforcement
- Rate limiting
- Idempotency
- Webhook processing
- Concurrency controls

### Phase 3: UI Flow Tests
Manual testing of:
- Permission-based UI hiding
- MFA prompts
- Toast notifications
- Error messages

### Phase 4: End-to-End Workflows
Full user journeys:
- Super Admin → Owner → Admin flows
- Payment → Refund → Settlement flows
- Alert trigger → Acknowledge → Resolve flows

---

## Test Result Logging

All test results are logged to:
- `audit_logs`: Test execution actions
- `admin_activity`: Test operator actions
- Custom `test_results` table (optional):

```sql
CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL, -- pass/fail/warning
  details JSONB,
  executed_by UUID REFERENCES profiles(id),
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Viewing Test Results

Navigate to `/reports/gap` to view:
- Test execution summary
- Pass/fail/warning counts
- Detailed test results table
- Security compliance checklist
- Auto-fix recommendations
- Export functionality

---

Last Updated: 2025-10-22
