-- Function to detect abnormal password reset activity
CREATE OR REPLACE FUNCTION public.detect_password_reset_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reset_count INTEGER;
  daily_threshold INTEGER := 5;
  hourly_threshold INTEGER := 3;
  hourly_count INTEGER;
  alert_exists BOOLEAN;
  tenant_name TEXT;
  actor_name TEXT;
BEGIN
  -- Only process password_reset actions
  IF NEW.action != 'password_reset' THEN
    RETURN NEW;
  END IF;

  -- Get actor name for alert details
  SELECT full_name INTO actor_name
  FROM public.profiles
  WHERE id = NEW.actor_user_id;

  -- Count password resets in last 24 hours for this tenant
  SELECT COUNT(*) INTO reset_count
  FROM public.audit_logs
  WHERE action = 'password_reset'
  AND tenant_id = NEW.tenant_id
  AND created_at > now() - interval '24 hours';

  -- Count password resets in last hour
  SELECT COUNT(*) INTO hourly_count
  FROM public.audit_logs
  WHERE action = 'password_reset'
  AND tenant_id = NEW.tenant_id
  AND created_at > now() - interval '1 hour';

  -- Get tenant name for alert
  SELECT name INTO tenant_name
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Check hourly threshold (more critical)
  IF hourly_count >= hourly_threshold THEN
    -- Check if alert already exists in last hour
    SELECT EXISTS (
      SELECT 1 FROM public.security_alerts
      WHERE alert_type = 'password_reset_spike_hourly'
      AND tenant_id = NEW.tenant_id
      AND created_at > now() - interval '1 hour'
      AND status IN ('open', 'acknowledged')
    ) INTO alert_exists;

    IF NOT alert_exists THEN
      INSERT INTO public.security_alerts (
        tenant_id,
        alert_type,
        severity,
        title,
        description,
        event_count,
        metadata
      ) VALUES (
        NEW.tenant_id,
        'password_reset_spike_hourly',
        'critical',
        'Suspicious Password Reset Activity Detected',
        format('Detected %s password resets in the last hour for tenant %s. This may indicate a security incident or compromised admin account.',
          hourly_count, COALESCE(tenant_name, 'Unknown')),
        hourly_count,
        jsonb_build_object(
          'time_window', '1 hour',
          'threshold', hourly_threshold,
          'detection_time', now(),
          'actor_user_id', NEW.actor_user_id,
          'actor_name', actor_name,
          'tenant_name', tenant_name
        )
      );

      -- Log security event
      INSERT INTO public.security_events (
        tenant_id,
        event_type,
        severity,
        ip_address,
        user_agent,
        user_id,
        event_data
      ) VALUES (
        NEW.tenant_id,
        'password_reset_anomaly',
        'critical',
        NEW.ip::inet,
        NEW.user_agent,
        NEW.actor_user_id,
        jsonb_build_object(
          'reset_count_hourly', hourly_count,
          'threshold', hourly_threshold,
          'actor_name', actor_name
        )
      );
    END IF;
  END IF;

  -- Check daily threshold
  IF reset_count >= daily_threshold THEN
    -- Check if alert already exists today
    SELECT EXISTS (
      SELECT 1 FROM public.security_alerts
      WHERE alert_type = 'password_reset_spike_daily'
      AND tenant_id = NEW.tenant_id
      AND created_at > CURRENT_DATE
      AND status IN ('open', 'acknowledged')
    ) INTO alert_exists;

    IF NOT alert_exists THEN
      INSERT INTO public.security_alerts (
        tenant_id,
        alert_type,
        severity,
        title,
        description,
        event_count,
        metadata
      ) VALUES (
        NEW.tenant_id,
        'password_reset_spike_daily',
        'high',
        'High Volume of Password Resets Detected',
        format('Detected %s password resets in the last 24 hours for tenant %s. Please review if this is expected activity.',
          reset_count, COALESCE(tenant_name, 'Unknown')),
        reset_count,
        jsonb_build_object(
          'time_window', '24 hours',
          'threshold', daily_threshold,
          'detection_time', now(),
          'actor_user_id', NEW.actor_user_id,
          'actor_name', actor_name,
          'tenant_name', tenant_name
        )
      );

      -- Log security event
      INSERT INTO public.security_events (
        tenant_id,
        event_type,
        severity,
        ip_address,
        user_agent,
        user_id,
        event_data
      ) VALUES (
        NEW.tenant_id,
        'password_reset_anomaly',
        'high',
        NEW.ip::inet,
        NEW.user_agent,
        NEW.actor_user_id,
        jsonb_build_object(
          'reset_count_daily', reset_count,
          'threshold', daily_threshold,
          'actor_name', actor_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on audit_logs for password reset detection
DROP TRIGGER IF EXISTS trg_detect_password_reset_anomaly ON public.audit_logs;
CREATE TRIGGER trg_detect_password_reset_anomaly
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_password_reset_anomaly();

-- Add comment
COMMENT ON FUNCTION public.detect_password_reset_anomaly() IS 
'Automatically detects and alerts on abnormal password reset activity. Triggers on >= 3 resets/hour (critical) or >= 5 resets/day (high).';