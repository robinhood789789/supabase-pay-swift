// Rate limiting with lock-out mechanism for MFA attempts

interface RateLimitStore {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const store = new Map<string, RateLimitStore>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  isLocked?: boolean;
  lockedUntil?: number;
}

/**
 * Check rate limit with lock-out mechanism
 * @param key Unique identifier (e.g., "mfa:user_id" or "mfa:ip")
 * @param maxAttempts Maximum attempts before lock-out
 * @param windowMs Time window in milliseconds
 * @param lockoutDuration Lock-out duration in milliseconds (default: 15 minutes)
 */
export function checkRateLimit(
  key: string, 
  maxAttempts: number = 5, 
  windowMs: number = 60000, // 1 minute
  lockoutDuration: number = 900000 // 15 minutes
): RateLimitResult {
  const now = Date.now();
  const limitKey = `ratelimit:${key}`;
  
  let entry = store.get(limitKey);
  
  // Check if locked
  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.lockedUntil,
      isLocked: true,
      lockedUntil: entry.lockedUntil
    };
  }
  
  // Reset if window expired or lock expired
  if (!entry || now - entry.firstAttemptAt > windowMs || (entry.lockedUntil && now >= entry.lockedUntil)) {
    entry = {
      attempts: 1,
      firstAttemptAt: now
    };
    store.set(limitKey, entry);
    
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: now + windowMs
    };
  }
  
  // Increment attempts
  entry.attempts++;
  
  // Lock if max attempts exceeded
  if (entry.attempts > maxAttempts) {
    entry.lockedUntil = now + lockoutDuration;
    store.set(limitKey, entry);
    
    console.log(`[Rate Limit] Locked out: ${key} until ${new Date(entry.lockedUntil).toISOString()}`);
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.lockedUntil,
      isLocked: true,
      lockedUntil: entry.lockedUntil
    };
  }
  
  store.set(limitKey, entry);
  
  return {
    allowed: true,
    remaining: maxAttempts - entry.attempts,
    resetAt: entry.firstAttemptAt + windowMs
  };
}

/**
 * Reset rate limit for a key (e.g., on successful verification)
 */
export function resetRateLimit(key: string): void {
  const limitKey = `ratelimit:${key}`;
  store.delete(limitKey);
  console.log(`[Rate Limit] Reset: ${key}`);
}

/**
 * Cleanup expired entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];
  
  store.forEach((entry, key) => {
    // Remove if window expired and not locked
    if (!entry.lockedUntil && now - entry.firstAttemptAt > 3600000) { // 1 hour
      expiredKeys.push(key);
    }
    // Remove if lock expired
    else if (entry.lockedUntil && now > entry.lockedUntil + 3600000) { // 1 hour after unlock
      expiredKeys.push(key);
    }
  });
  
  expiredKeys.forEach(key => store.delete(key));
  
  if (expiredKeys.length > 0) {
    console.log(`[Rate Limit] Cleaned up ${expiredKeys.length} expired entries`);
  }
}
