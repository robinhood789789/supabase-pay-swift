/**
 * Concurrency control utilities for preventing race conditions
 */

export interface LockOptions {
  lockKey: string;
  timeoutMs?: number;
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  error?: string;
}

/**
 * Acquire an advisory lock using PostgreSQL pg_advisory_lock
 * This prevents concurrent processing of the same resource
 */
export async function acquireAdvisoryLock(
  supabase: any,
  lockKey: string,
  timeoutMs: number = 5000
): Promise<LockResult> {
  try {
    // Convert lock key to integer hash for pg_advisory_lock
    const lockHash = hashStringToInt(lockKey);
    
    // Try to acquire non-blocking lock
    const { data, error } = await supabase.rpc('pg_try_advisory_lock', {
      lock_id: lockHash
    });

    if (error) {
      console.error('Advisory lock error:', error);
      return { acquired: false, error: error.message };
    }

    if (data === true) {
      return { acquired: true, lockId: lockKey };
    }

    return { acquired: false, error: 'Lock already held by another process' };
  } catch (error) {
    console.error('Lock acquisition error:', error);
    return { acquired: false, error: (error as Error).message };
  }
}

/**
 * Release an advisory lock
 */
export async function releaseAdvisoryLock(
  supabase: any,
  lockKey: string
): Promise<boolean> {
  try {
    const lockHash = hashStringToInt(lockKey);
    
    const { data, error } = await supabase.rpc('pg_advisory_unlock', {
      lock_id: lockHash
    });

    if (error) {
      console.error('Advisory unlock error:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Lock release error:', error);
    return false;
  }
}

/**
 * Execute function with advisory lock (auto-acquire and release)
 */
export async function withAdvisoryLock<T>(
  supabase: any,
  lockKey: string,
  fn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<{ success: boolean; result?: T; error?: string }> {
  const lock = await acquireAdvisoryLock(supabase, lockKey, timeoutMs);
  
  if (!lock.acquired) {
    return { success: false, error: lock.error || 'Failed to acquire lock' };
  }

  try {
    const result = await fn();
    return { success: true, result };
  } catch (error) {
    console.error('Locked function error:', error);
    return { success: false, error: (error as Error).message };
  } finally {
    await releaseAdvisoryLock(supabase, lockKey);
  }
}

/**
 * Check for concurrent refund attempts (using database unique constraint)
 */
export async function checkRefundConcurrency(
  supabase: any,
  paymentId: string,
  amount: number
): Promise<{ allowed: boolean; error?: string }> {
  // Check existing pending/processing refunds for this payment
  const { data: existingRefunds } = await supabase
    .from('refunds')
    .select('id, amount, status')
    .eq('payment_id', paymentId)
    .in('status', ['pending', 'processing']);

  if (existingRefunds && existingRefunds.length > 0) {
    return {
      allowed: false,
      error: 'Another refund is already being processed for this payment'
    };
  }

  // Check total refunded amount
  const { data: completedRefunds } = await supabase
    .from('refunds')
    .select('amount')
    .eq('payment_id', paymentId)
    .eq('status', 'succeeded');

  const totalRefunded = completedRefunds?.reduce((sum: number, r: any) => sum + r.amount, 0) || 0;
  
  // Get original payment amount
  const { data: payment } = await supabase
    .from('payments')
    .select('amount')
    .eq('id', paymentId)
    .single();

  if (payment && totalRefunded + amount > payment.amount) {
    return {
      allowed: false,
      error: 'Total refund amount would exceed payment amount'
    };
  }

  return { allowed: true };
}

/**
 * Hash string to 32-bit integer for advisory locks
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Rate limit check (simple in-memory for edge functions)
 * In production, use Redis or database-backed rate limiting
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  error?: string;
}

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = rateLimitMap.get(identifier);

  if (!existing || existing.resetAt < now) {
    // New window
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      error: 'Rate limit exceeded'
    };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt
  };
}
