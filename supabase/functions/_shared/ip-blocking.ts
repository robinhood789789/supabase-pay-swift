import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

/**
 * Check if an IP address is blocked
 */
export async function isIPBlocked(
  supabase: SupabaseClient,
  ipAddress: string
): Promise<{ blocked: boolean; reason?: string; blockedUntil?: string }> {
  try {
    const { data, error } = await supabase
      .rpc('is_ip_blocked', { check_ip: ipAddress });

    if (error) {
      console.error('Error checking IP block:', error);
      return { blocked: false };
    }

    if (data) {
      // Get block details
      const { data: blockData } = await supabase
        .from('ip_blocks')
        .select('reason, blocked_until, is_permanent')
        .eq('ip_address', ipAddress)
        .single();

      return {
        blocked: true,
        reason: blockData?.reason,
        blockedUntil: blockData?.is_permanent ? 'permanent' : blockData?.blocked_until,
      };
    }

    return { blocked: false };
  } catch (error) {
    console.error('IP blocking check error:', error);
    return { blocked: false };
  }
}

/**
 * Check and auto-block IP if threshold is exceeded
 */
export async function checkAndBlockIP(
  supabase: SupabaseClient,
  ipAddress: string,
  violationType: string,
  threshold: number = 10,
  blockDurationMinutes: number = 60
): Promise<{ shouldBlock: boolean; violationCount: number }> {
  try {
    const { data, error } = await supabase
      .rpc('check_and_block_ip', {
        check_ip: ipAddress,
        violation_type: violationType,
        threshold,
        block_duration_minutes: blockDurationMinutes,
      });

    if (error) {
      console.error('Error auto-blocking IP:', error);
      return { shouldBlock: false, violationCount: 0 };
    }

    console.log('[Auto-Block Check]', {
      ip: ipAddress,
      shouldBlock: data.should_block,
      violationCount: data.violation_count,
      threshold: data.threshold,
    });

    return {
      shouldBlock: data.should_block,
      violationCount: data.violation_count,
    };
  } catch (error) {
    console.error('Auto-block check error:', error);
    return { shouldBlock: false, violationCount: 0 };
  }
}

/**
 * Middleware to check IP blocking before processing request
 */
export async function checkIPBlockingMiddleware(
  supabase: SupabaseClient,
  req: Request
): Promise<{ allowed: boolean; response?: Response }> {
  const ipAddress = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';

  if (ipAddress === 'unknown') {
    return { allowed: true };
  }

  const blockCheck = await isIPBlocked(supabase, ipAddress);

  if (blockCheck.blocked) {
    console.log('[Request Blocked]', {
      ip: ipAddress,
      reason: blockCheck.reason,
      blockedUntil: blockCheck.blockedUntil,
    });

    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Access denied',
          message: 'Your IP address has been blocked',
          reason: blockCheck.reason,
          blockedUntil: blockCheck.blockedUntil,
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      ),
    };
  }

  return { allowed: true };
}
