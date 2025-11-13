# Logging & Error Handling Guide

This guide explains how to use the improved logging and error handling utilities in edge functions.

## Quick Start

```typescript
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { AuthenticationError, ValidationError, handleEnhancedError } from '../_shared/enhanced-errors.ts';

serve(async (req) => {
  const logger = createLogger('my-function-name');
  
  try {
    // Log incoming request
    logger.logRequest(req);
    
    // Extract and set request context
    const context = extractRequestContext(req);
    logger.setContext(context);
    
    // Your logic here...
    logger.info('Processing started', { someData: 'value' });
    
    // Set user context after authentication
    logger.setContext({ userId: user.id, tenantId: tenantId });
    
    // Log success
    const response = { success: true, data: result };
    logger.logResponse(200, response);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
```

## Logger Methods

### `createLogger(functionName: string)`
Creates a new logger instance for a specific function.

```typescript
const logger = createLogger('payment-links-create');
```

### `setContext(context: Partial<LogContext>)`
Adds context that will be included in all subsequent log entries.

```typescript
logger.setContext({
  userId: user.id,
  tenantId: tenantId,
  ip: '192.168.1.1',
});
```

### `logRequest(req: Request)`
Logs details about incoming HTTP request.

```typescript
logger.logRequest(req);
// Logs: method, path, query params, headers (sanitized)
```

### `logResponse(status: number, body?: any)`
Logs response details including duration.

```typescript
logger.logResponse(200, { success: true });
// Includes automatic duration calculation
```

### Log Levels

```typescript
// Debug - Detailed information for diagnostics
logger.debug('Cache hit', { key: 'user:123', ttl: 300 });

// Info - General informational messages
logger.info('Payment processed', { paymentId: 'pay_123', amount: 100 });

// Warn - Warning messages for potentially harmful situations
logger.warn('API rate limit approaching', { current: 95, limit: 100 });

// Error - Error events that might still allow the application to continue
logger.error('Database query failed', dbError, { query: 'SELECT...' });

// Fatal - Severe errors that cause application termination
logger.fatal('Critical service unavailable', serviceError);
```

## Error Handling

### Predefined Error Classes

```typescript
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
} from '../_shared/enhanced-errors.ts';
```

### Usage Examples

```typescript
// Authentication
if (!authHeader) {
  throw new AuthenticationError('Missing authorization header');
}

// Authorization
if (!hasPermission) {
  throw new AuthorizationError('Insufficient permissions', {
    required: 'admin',
    actual: 'user',
  });
}

// Validation
if (!email) {
  throw new ValidationError('Email is required', {
    field: 'email',
    received: null,
  });
}

// Not Found
const user = await findUser(id);
if (!user) {
  throw new NotFoundError('User', { userId: id });
}

// Conflict
if (existingUser) {
  throw new ConflictError('User already exists', {
    email: user.email,
  });
}

// Rate Limit
if (attempts > maxAttempts) {
  throw new RateLimitError('Too many attempts', {
    attempts,
    maxAttempts,
    resetAt: new Date(resetTime).toISOString(),
  });
}

// External Service
try {
  await stripeApi.charge(params);
} catch (err) {
  throw new ExternalServiceError('Stripe', 'Payment processing failed', {
    statusCode: err.statusCode,
  });
}

// Database
try {
  await supabase.from('users').insert(data);
} catch (err) {
  throw new DatabaseError('Failed to create user', {
    table: 'users',
    operation: 'insert',
  });
}
```

### Central Error Handler

The `handleEnhancedError` function automatically:
- Logs errors with appropriate severity
- Returns proper HTTP responses
- Includes error metadata
- Sanitizes sensitive information

```typescript
serve(async (req) => {
  const logger = createLogger('my-function');
  
  try {
    // Your code here
  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
```

## Best Practices

### 1. Always Create Logger Early
```typescript
serve(async (req) => {
  const logger = createLogger('function-name');
  // Continue with your logic
});
```

### 2. Set Context Progressively
```typescript
// Start with request context
const context = extractRequestContext(req);
logger.setContext(context);

// Add user context after authentication
logger.setContext({ userId: user.id });

// Add tenant context when available
logger.setContext({ tenantId: tenantId });
```

### 3. Log Important Actions
```typescript
logger.info('User authenticated', { email: user.email });
logger.info('Database query executed', { rowsAffected: 5 });
logger.info('Payment processed', { amount: 100, currency: 'THB' });
```

### 4. Use Appropriate Log Levels
- `debug` - Only for development/debugging
- `info` - Normal operations
- `warn` - Unexpected but handled situations
- `error` - Errors that can be recovered from
- `fatal` - Critical errors requiring immediate attention

### 5. Include Relevant Metadata
```typescript
logger.error('Payment failed', error, {
  paymentId: payment.id,
  amount: payment.amount,
  provider: payment.provider,
  attemptNumber: retryCount,
});
```

### 6. Don't Log Sensitive Data
```typescript
// ❌ Bad - Logs password
logger.info('User login', { email, password });

// ✅ Good - Omits sensitive data
logger.info('User login attempt', { email });
```

### 7. Use Structured Errors
```typescript
// ❌ Bad - Generic error
throw new Error('Something went wrong');

// ✅ Good - Specific, structured error
throw new ValidationError('Invalid email format', {
  field: 'email',
  value: email,
  pattern: EMAIL_REGEX,
});
```

## Example: Complete Edge Function

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  handleEnhancedError,
} from '../_shared/enhanced-errors.ts';

serve(async (req) => {
  // Initialize logger
  const logger = createLogger('my-awesome-function');
  
  // Handle CORS
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    // Log request and set context
    logger.logRequest(req);
    const requestContext = extractRequestContext(req);
    logger.setContext(requestContext);
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AuthenticationError('Missing authorization header');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error('Authentication failed', authError);
      throw new AuthenticationError('Invalid credentials');
    }

    // Add user to context
    logger.setContext({ userId: user.id });
    logger.info('User authenticated', { email: user.email });

    // Parse and validate request body
    const body = await req.json();
    if (!body.name) {
      throw new ValidationError('Name is required', {
        field: 'name',
        received: body.name,
      });
    }

    logger.debug('Request validated', { bodyKeys: Object.keys(body) });

    // Perform business logic
    logger.info('Processing request', { action: 'create_item' });
    
    const { data: item, error: dbError } = await supabase
      .from('items')
      .insert({ name: body.name, user_id: user.id })
      .select()
      .single();

    if (dbError) {
      logger.error('Database error', dbError);
      throw new DatabaseError('Failed to create item', {
        table: 'items',
        operation: 'insert',
      });
    }

    if (!item) {
      throw new NotFoundError('Item');
    }

    logger.info('Item created successfully', {
      itemId: item.id,
      duration: logger.getDuration(),
    });

    // Prepare response
    const response = { success: true, item };
    logger.logResponse(200, response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return handleEnhancedError(error, logger);
  }
});
```

## Log Output Format

Logs are structured JSON for easy parsing:

```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "context": {
    "functionName": "payment-links-create",
    "requestId": "abc-123-def",
    "userId": "user_123",
    "tenantId": "tenant_456",
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "duration": 145,
  "message": "Processing request"
}
```

## Migration Guide

To migrate existing edge functions:

1. Import the new utilities:
```typescript
import { createLogger, extractRequestContext } from '../_shared/logger.ts';
import { handleEnhancedError } from '../_shared/enhanced-errors.ts';
```

2. Replace `console.log/error` with logger methods

3. Replace generic `Error` throws with specific error classes

4. Wrap main logic in try-catch with `handleEnhancedError`

5. Use `logger.setContext()` to progressively add context
