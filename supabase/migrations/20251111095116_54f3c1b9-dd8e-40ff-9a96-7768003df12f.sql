-- Fix Function Search Path Warnings
-- เพิ่ม search_path ให้กับ functions ที่ยังไม่มี

-- Fix is_ip_blocked function
CREATE OR REPLACE FUNCTION public.is_ip_blocked(check_ip inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.ip_blocks
    WHERE ip_address = check_ip
    AND (
      is_permanent = true 
      OR blocked_until IS NULL 
      OR blocked_until > now()
    )
  );
END;
$$;

-- Fix check_and_block_ip function
CREATE OR REPLACE FUNCTION public.check_and_block_ip(
  check_ip inet,
  violation_type text,
  threshold integer DEFAULT 10,
  block_duration_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  violation_count INTEGER;
  should_block BOOLEAN := false;
  block_record RECORD;
BEGIN
  -- Count recent violations (last hour)
  SELECT COUNT(*) INTO violation_count
  FROM public.security_events
  WHERE ip_address = check_ip
  AND created_at > now() - interval '1 hour'
  AND severity IN ('high', 'critical');

  -- Check if threshold is exceeded
  IF violation_count >= threshold THEN
    should_block := true;
    
    -- Insert or update IP block
    INSERT INTO public.ip_blocks (
      ip_address,
      reason,
      violation_count,
      blocked_until,
      is_permanent,
      metadata
    ) VALUES (
      check_ip,
      violation_type,
      violation_count,
      now() + (block_duration_minutes || ' minutes')::interval,
      false,
      jsonb_build_object('auto_blocked', true, 'threshold', threshold)
    )
    ON CONFLICT (ip_address) 
    DO UPDATE SET
      violation_count = ip_blocks.violation_count + 1,
      last_violation_at = now(),
      blocked_until = CASE 
        WHEN ip_blocks.violation_count > threshold * 2 THEN NULL
        ELSE now() + (block_duration_minutes || ' minutes')::interval
      END,
      is_permanent = CASE 
        WHEN ip_blocks.violation_count > threshold * 2 THEN true
        ELSE false
      END,
      updated_at = now()
    RETURNING * INTO block_record;

    -- Create security alert
    INSERT INTO public.security_alerts (
      alert_type,
      severity,
      title,
      description,
      metadata
    ) VALUES (
      'ip_auto_blocked',
      'high',
      'IP Address Automatically Blocked',
      'IP ' || check_ip::text || ' has been automatically blocked after ' || violation_count || ' violations',
      jsonb_build_object(
        'ip_address', check_ip::text,
        'violation_count', violation_count,
        'block_duration_minutes', block_duration_minutes
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'should_block', should_block,
    'violation_count', violation_count,
    'threshold', threshold
  );
END;
$$;

COMMENT ON FUNCTION public.is_ip_blocked IS 'ตรวจสอบว่า IP address ถูก block อยู่หรือไม่ (SECURITY DEFINER with search_path)';
COMMENT ON FUNCTION public.check_and_block_ip IS 'ตรวจสอบและ block IP address อัตโนมัติตามจำนวน violations (SECURITY DEFINER with search_path)';
