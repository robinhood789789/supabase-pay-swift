-- Function to detect password breach spike and create alert
CREATE OR REPLACE FUNCTION public.detect_password_breach_spike()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  breach_count INTEGER;
  recent_minutes INTEGER := 15;
  threshold INTEGER := 5;
  alert_exists BOOLEAN;
BEGIN
  -- Only process password breach events
  IF NEW.event_type != 'password_breach_detected' THEN
    RETURN NEW;
  END IF;

  -- Count password breach events in last 15 minutes
  SELECT COUNT(*) INTO breach_count
  FROM public.security_events
  WHERE event_type = 'password_breach_detected'
  AND created_at > now() - (recent_minutes || ' minutes')::interval
  AND (tenant_id = NEW.tenant_id OR (tenant_id IS NULL AND NEW.tenant_id IS NULL));

  -- Check if threshold exceeded
  IF breach_count >= threshold THEN
    -- Check if alert already exists in last hour
    SELECT EXISTS (
      SELECT 1 FROM public.security_alerts
      WHERE alert_type = 'password_breach_spike'
      AND (tenant_id = NEW.tenant_id OR (tenant_id IS NULL AND NEW.tenant_id IS NULL))
      AND created_at > now() - interval '1 hour'
      AND status IN ('open', 'acknowledged')
    ) INTO alert_exists;

    -- Create alert if it doesn't exist
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
        'password_breach_spike',
        'high',
        'Multiple Password Breach Attempts Detected',
        format('Detected %s password breach attempts in the last %s minutes. Users are attempting to use compromised passwords.', 
          breach_count, recent_minutes),
        breach_count,
        jsonb_build_object(
          'time_window_minutes', recent_minutes,
          'threshold', threshold,
          'detection_time', now()
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for password breach spike detection
DROP TRIGGER IF EXISTS trg_detect_password_breach_spike ON public.security_events;
CREATE TRIGGER trg_detect_password_breach_spike
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_password_breach_spike();