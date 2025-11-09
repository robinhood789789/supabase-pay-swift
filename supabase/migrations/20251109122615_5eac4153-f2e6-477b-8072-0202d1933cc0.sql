-- Create IP blocks table
CREATE TABLE IF NOT EXISTS public.ip_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  violation_count INTEGER NOT NULL DEFAULT 0,
  last_violation_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_by UUID REFERENCES auth.users(id),
  is_permanent BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on ip_address for fast lookups
CREATE INDEX IF NOT EXISTS idx_ip_blocks_ip_address ON public.ip_blocks(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blocks_blocked_until ON public.ip_blocks(blocked_until);

-- Enable RLS
ALTER TABLE public.ip_blocks ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all IP blocks
CREATE POLICY "Super admins can manage IP blocks"
ON public.ip_blocks
FOR ALL
USING (is_super_admin(auth.uid()));

-- Tenant admins can view IP blocks
CREATE POLICY "Tenant admins can view IP blocks"
ON public.ip_blocks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM memberships m
    JOIN roles r ON m.role_id = r.id
    WHERE m.user_id = auth.uid()
    AND r.name IN ('owner', 'admin')
  )
);

-- Create function to check if IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(check_ip INET)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to auto-block IP after threshold
CREATE OR REPLACE FUNCTION public.check_and_block_ip(
  check_ip INET,
  violation_type TEXT,
  threshold INTEGER DEFAULT 10,
  block_duration_minutes INTEGER DEFAULT 60
)
RETURNS JSONB AS $$
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
        WHEN ip_blocks.violation_count > threshold * 2 THEN NULL -- Permanent block
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ip_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ip_blocks_updated_at
BEFORE UPDATE ON public.ip_blocks
FOR EACH ROW
EXECUTE FUNCTION update_ip_blocks_updated_at();