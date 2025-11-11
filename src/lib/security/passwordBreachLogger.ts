import { supabase } from '@/integrations/supabase/client';

interface PasswordBreachLogData {
  userId?: string;
  email?: string;
  context: 'signup' | 'password_change' | 'first_login';
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Log password breach detection events to security monitoring system
 */
export async function logPasswordBreachEvent(data: PasswordBreachLogData) {
  try {
    const eventData = {
      event_type: 'password_breach_detected',
      severity: 'medium',
      event_data: {
        context: data.context,
        email: data.email,
        timestamp: new Date().toISOString(),
        user_agent: data.userAgent || navigator?.userAgent,
      },
      user_id: data.userId,
      blocked: true,
    };

    // Log to security events via edge function
    const { error } = await supabase.functions.invoke('security-event-log', {
      body: eventData,
    });

    if (error) {
      console.error('Failed to log password breach event:', error);
    } else {
      console.info('Password breach event logged:', data.context);
    }
  } catch (error) {
    // Don't throw errors - logging failures shouldn't block user flow
    console.error('Error logging password breach event:', error);
  }
}

/**
 * Log successful password change after breach rejection
 */
export async function logPasswordBreachResolution(data: PasswordBreachLogData) {
  try {
    const eventData = {
      event_type: 'password_breach_resolved',
      severity: 'info',
      event_data: {
        context: data.context,
        email: data.email,
        timestamp: new Date().toISOString(),
        user_agent: data.userAgent || navigator?.userAgent,
      },
      user_id: data.userId,
      blocked: false,
    };

    await supabase.functions.invoke('security-event-log', {
      body: eventData,
    });

    console.info('Password breach resolution logged:', data.context);
  } catch (error) {
    console.error('Error logging password breach resolution:', error);
  }
}
