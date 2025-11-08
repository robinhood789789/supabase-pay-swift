# Payment API Endpoints

## Checkout & Sessions

### POST /api/v1/checkout/sessions
**Purpose**: Create a new payment checkout session

**Authentication**: Required (Bearer token or API key)

**MFA**: Required for user-initiated payments (action: `create-payment`)

**Headers**:
```http
Authorization: Bearer <token> OR sk_test_xxx
X-Tenant: <tenant_id>
Idempotency-Key: <optional_unique_key>
```

**Request Body**:
```json
{
  "amount": 10000,
  "currency": "USD",
  "reference": "order_12345",
  "methodTypes": ["card"],
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel"
}
```

**Response**:
```json
{
  "id": "session_uuid",
  "redirect_url": "https://checkout.stripe.com/...",
  "qr_image_url": "https://...",
  "status": "pending",
  "expires_at": "2025-10-22T10:30:00Z"
}
```

**Rate Limit**: 10 requests/minute per tenant

**Audit Log**: Yes (`checkout.session.created`)

---

### GET /api/v1/checkout/sessions/:id
**Purpose**: Retrieve checkout session status

**Authentication**: Required

**MFA**: No

**Headers**:
```http
Authorization: Bearer <token>
X-Tenant: <tenant_id>
```

**Response**:
```json
{
  "id": "session_uuid",
  "status": "completed",
  "amount": 10000,
  "currency": "USD",
  "reference": "order_12345",
  "redirect_url": "https://...",
  "qr_image_url": "https://...",
  "expires_at": "2025-10-22T10:30:00Z",
  "created_at": "2025-10-22T10:00:00Z",
  "remaining_seconds": 1200
}
```

**Rate Limit**: 30 requests/minute per tenant

---

## Refunds

### POST /api/v1/refunds
**Purpose**: Process a refund for a payment

**Authentication**: Required (Bearer token)

**MFA**: Required (action: `refund`)

**Permission**: `refunds:create`

**Headers**:
```http
Authorization: Bearer <token>
X-Tenant: <tenant_id>
```

**Request Body**:
```json
{
  "paymentId": "payment_uuid",
  "amount": 5000,
  "reason": "Customer request"
}
```

**Response**:
```json
{
  "refundId": "refund_uuid",
  "status": "pending",
  "amount": 5000,
  "providerRefundId": "re_123456"
}
```

**Rate Limit**: 5 requests/minute per tenant (strict)

**Audit Log**: Yes (`refund.created`, `refund.failed`)

---

## Public Payment Links

### GET /api/v1/links/:slug
**Purpose**: Get public payment link information

**Authentication**: None (public endpoint)

**MFA**: No

**Response**:
```json
{
  "slug": "summer-promo",
  "amount": 9900,
  "currency": "USD",
  "reference": "promo_ref",
  "status": "active",
  "expires_at": "2025-12-31T23:59:59Z",
  "isExpired": false,
  "usageLimitReached": false,
  "canPay": true
}
```

**Rate Limit**: 10 requests/minute per IP

---

### POST /api/v1/links/:slug/checkout
**Purpose**: Create checkout session for payment link

**Authentication**: None (public endpoint)

**MFA**: No

**Request Body**:
```json
{
  "methodTypes": ["card", "promptpay"]
}
```

**Response**:
```json
{
  "sessionId": "session_uuid",
  "redirectUrl": "https://...",
  "qrImageUrl": "https://...",
  "expiresAt": "2025-10-22T10:30:00Z"
}
```

**Rate Limit**: 3 requests/minute per IP (strict)

**Audit Log**: No (public endpoint)

---

## API Keys

### POST /api/keys:create
**Purpose**: Generate new API key

**Authentication**: Required (Bearer token)

**MFA**: Required (action: `api-keys`)

**Permission**: `api_keys.manage`

**Headers**:
```http
Authorization: Bearer <token>
X-Tenant: <tenant_id>
```

**Request Body**:
```json
{
  "name": "Production Server"
}
```

**Response**:
```json
{
  "id": "key_uuid",
  "name": "Production Server",
  "prefix": "sk_live",
  "secret": "sk_live_abc123xyz789",
  "created_at": "2025-10-22T10:00:00Z"
}
```

**Important**: Secret shown only once! Store securely.

**Rate Limit**: 10 requests/minute per tenant

**Audit Log**: Yes (`api_key.created`)

---

### POST /api/keys:revoke
**Purpose**: Revoke an API key

**Authentication**: Required (Bearer token)

**MFA**: Required (action: `api-keys`)

**Permission**: `api_keys.manage`

**Headers**:
```http
Authorization: Bearer <token>
X-Tenant: <tenant_id>
```

**Request Body**:
```json
{
  "keyId": "key_uuid"
}
```

**Response**:
```json
{
  "success": true,
  "revokedAt": "2025-10-22T10:30:00Z"
}
```

**Rate Limit**: 10 requests/minute per tenant

**Audit Log**: Yes (`api_key.revoked`)

---

## Webhooks

### POST /api/webhooks/test
**Purpose**: Send test webhook event

**Authentication**: Required (Bearer token)

**MFA**: Required (action: `webhooks`)

**Permission**: `webhooks.manage`

**Headers**:
```http
Authorization: Bearer <token>
X-Tenant: <tenant_id>
```

**Request Body**:
```json
{
  "eventType": "payment.succeeded",
  "data": {
    "paymentId": "test_payment_123"
  }
}
```

**Response**:
```json
{
  "sent": true,
  "webhookEventId": "event_uuid",
  "targetUrl": "https://your-webhook.com/endpoint"
}
```

**Rate Limit**: 5 requests/minute per tenant

**Audit Log**: Yes (`webhook.test.sent`)

---

### POST /api/webhooks/stripe
**Purpose**: Receive Stripe webhook events

**Authentication**: Signature verification

**MFA**: No (external service)

**Headers**:
```http
Stripe-Signature: t=xxx,v1=yyy
```

**Handles Events**:
- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.failed`
- `charge.refunded`

**Idempotency**: Automatic via `provider_events` table

**Rate Limit**: Provider-managed

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Valid amount is required",
  "code": "INVALID_AMOUNT"
}
```

### 401 Unauthorized
```json
{
  "error": "MFA required",
  "code": "MFA_CHALLENGE_REQUIRED"
}
```

### 403 Forbidden
```json
{
  "error": "Missing refunds:create permission",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

### 404 Not Found
```json
{
  "error": "Payment not found",
  "code": "RESOURCE_NOT_FOUND"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to process refund",
  "code": "INTERNAL_ERROR"
}
```

---

## Testing

### Test Mode
Use test API keys and test mode credentials:
- Stripe: `sk_test_...`
- Test cards: `4242 4242 4242 4242`

### Test Webhooks
Use webhook testing tool to simulate events:
```bash
stripe trigger checkout.session.completed
```

### MFA Testing
1. Enable 2FA for test user
2. Create checkout session
3. Verify MFA challenge triggered
4. Complete MFA verification
5. Retry checkout creation

---

## Best Practices

### For Merchants
1. Always use idempotency keys for checkout creation
2. Store webhook signatures for verification
3. Implement retry logic with exponential backoff
4. Monitor API key usage regularly
5. Rotate API keys quarterly

### For Developers
1. Never log sensitive data (PAN, CVV, full IPs)
2. Validate all inputs before provider calls
3. Use proper error handling
4. Implement rate limiting client-side
5. Test MFA flows thoroughly

### For Security
1. Enable MFA for all privileged users
2. Review audit logs weekly
3. Rotate API keys after incidents
4. Monitor for suspicious patterns
5. Keep dependencies updated

---

## SDK Examples

### Node.js
```javascript
const client = new PaymentClient({
  apiKey: 'sk_test_xxx',
  tenantId: 'tenant_uuid'
});

const session = await client.checkout.create({
  amount: 10000,
  currency: 'USD',
  reference: 'order_123'
});
```

### Python
```python
from payment_sdk import PaymentClient

client = PaymentClient(
    api_key='sk_test_xxx',
    tenant_id='tenant_uuid'
)

session = client.checkout.create(
    amount=10000,
    currency='USD',
    reference='order_123'
)
```

### PHP
```php
$client = new PaymentClient([
    'api_key' => 'sk_test_xxx',
    'tenant_id' => 'tenant_uuid'
]);

$session = $client->checkout->create([
    'amount' => 10000,
    'currency' => 'USD',
    'reference' => 'order_123'
]);
```

---

## Webhooks Implementation

### Express.js Example
```javascript
app.post('/webhooks/payment', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body, sig, webhookSecret
      );
      
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        await fulfillOrder(session);
      }
      
      res.json({ received: true });
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);
```

---

## Support & Resources

- **API Documentation**: https://docs.yourplatform.com/api
- **Security Guide**: See PAYMENT_API_SECURITY.md
- **Status Page**: https://status.yourplatform.com
- **Support**: support@yourplatform.com
- **Security Issues**: security@yourplatform.com
