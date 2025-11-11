import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export type SecurityEvent = any;
export type SecurityAlert = any;
export type SecurityMetrics = any;

export function useSecurityMonitoring() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !tenantId) {
      setLoading(false);
      return;
    }

    loadSecurityData();
    setupRealtime();

    return () => {
      // Cleanup realtime subscriptions
      supabase.removeAllChannels();
    };
  }, [user, tenantId]);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      // Load recent events
      const { data: eventsData, error: eventsError } = await supabase
        .from('security_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;
      setEvents(eventsData as any || []);

      // Load open alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'acknowledged'])
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false });

      if (alertsError) throw alertsError;
      setAlerts(alertsData as any || []);

      // Load recent metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('security_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('metric_date', { ascending: false })
        .limit(30);

      if (metricsError) throw metricsError;
      setMetrics(metricsData as any || []);

    } catch (error) {
      console.error('Error loading security data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security monitoring data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    // Subscribe to new security events
    const eventsChannel = supabase
      .channel('security-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_events',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newEvent = payload.new as any;
          setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);

          // Show toast for high/critical events
          if (newEvent.severity === 'high' || newEvent.severity === 'critical') {
            toast({
              title: `Security Event: ${newEvent.event_type}`,
              description: `Severity: ${newEvent.severity.toUpperCase()}`,
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe();

    // Subscribe to new security alerts
    const alertsChannel = supabase
      .channel('security-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'security_alerts',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newAlert = payload.new as any;
            setAlerts((prev) => [newAlert, ...prev]);

            // Show toast for new alerts with special handling for password breach spikes
            if (newAlert.alert_type === 'password_breach_spike') {
              toast({
                title: '🔒 Password Security Alert',
                description: `${newAlert.event_count} password breach attempts detected in the last 15 minutes. Users are trying to use compromised passwords.`,
                variant: 'destructive',
                duration: 10000,
              });
            } else {
              toast({
                title: 'New Security Alert',
                description: newAlert.title,
                variant: newAlert.severity === 'critical' ? 'destructive' : 'default',
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedAlert = payload.new as any;
            setAlerts((prev) =>
              prev.map((alert) =>
                alert.id === updatedAlert.id ? updatedAlert : alert
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setAlerts((prev) =>
              prev.filter((alert) => alert.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();
  };

  const logSecurityEvent = async (eventData: any) => {
    try {
      const { error } = await supabase.functions.invoke('security-event-log', {
        body: {
          tenantId: eventData.tenant_id,
          userId: eventData.user_id,
          eventType: eventData.event_type,
          severity: eventData.severity,
          eventData: eventData.event_data,
          endpoint: eventData.endpoint,
          requestId: eventData.request_id,
          blocked: eventData.blocked,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  };

  const updateAlert = async (
    alertId: string,
    action: 'acknowledge' | 'resolve' | 'mark_false_positive',
    notes?: string
  ) => {
    try {
      const { error } = await supabase.functions.invoke('security-alerts-manage', {
        body: {
          alertId,
          action,
          notes,
        },
      });

      if (error) throw error;

      toast({
        title: 'Alert Updated',
        description: `Alert has been ${action === 'acknowledge' ? 'acknowledged' : action === 'resolve' ? 'resolved' : 'marked as false positive'}`,
      });

      await loadSecurityData();
    } catch (error) {
      console.error('Error updating alert:', error);
      toast({
        title: 'Error',
        description: 'Failed to update alert',
        variant: 'destructive',
      });
    }
  };

  return {
    events,
    alerts,
    metrics,
    loading,
    logSecurityEvent,
    updateAlert,
    refresh: loadSecurityData,
  };
}