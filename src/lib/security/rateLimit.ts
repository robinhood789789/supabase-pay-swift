import { supabase } from '@/integrations/supabase/client';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'auth:signin': { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  'auth:signup': { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  'api:default': { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
};

export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS['api:default'];
  const windowStart = new Date(Date.now() - config.windowMs);

  try {
    // Clean up old entries
    await supabase
      .from('rate_limits')
      .delete()
      .lt('window_start', windowStart.toISOString());

    // Check current count
    const { data: existing, error } = await supabase
      .from('rate_limits')
      .select('count, window_start')
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Rate limit check error:', error);
      return { allowed: true, remaining: config.maxRequests, resetAt: new Date(Date.now() + config.windowMs) };
    }

    if (!existing) {
      // First request in window
      await supabase.from('rate_limits').insert({
        identifier,
        endpoint,
        count: 1,
        window_start: new Date().toISOString(),
      });
      return { allowed: true, remaining: config.maxRequests - 1, resetAt: new Date(Date.now() + config.windowMs) };
    }

    if (existing.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(new Date(existing.window_start).getTime() + config.windowMs),
      };
    }

    // Increment count
    await supabase
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .eq('window_start', existing.window_start);

    return {
      allowed: true,
      remaining: config.maxRequests - existing.count - 1,
      resetAt: new Date(new Date(existing.window_start).getTime() + config.windowMs),
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    return { allowed: true, remaining: config.maxRequests, resetAt: new Date(Date.now() + config.windowMs) };
  }
}
