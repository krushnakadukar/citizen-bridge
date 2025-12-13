-- Fix 1: Improve report creation policy to require proper validation
-- Drop existing permissive policy
DROP POLICY IF EXISTS "Users can create own reports or anonymous reports" ON public.reports;

-- Create stricter policy: authenticated users must set reporter_user_id correctly,
-- anonymous reports (is_anonymous=true) must have NULL reporter_user_id
CREATE POLICY "Validated report creation"
ON public.reports
FOR INSERT
WITH CHECK (
  -- For authenticated non-anonymous reports: must set reporter_user_id to own profile
  (
    auth.uid() IS NOT NULL AND
    is_anonymous = false AND 
    reporter_user_id = get_profile_id(auth.uid())
  )
  OR
  -- For anonymous reports: reporter_user_id must be NULL
  -- Anonymous reports allowed from authenticated users for whistleblower protection
  (
    is_anonymous = true AND 
    reporter_user_id IS NULL
  )
);

-- Fix 2: Improve HTML sanitization function with proper entity encoding
CREATE OR REPLACE FUNCTION public.sanitize_html(text_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  result text;
BEGIN
  IF text_input IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Step 1: HTML entity encode dangerous characters first
  result := text_input;
  result := replace(result, '&', '&amp;');
  result := replace(result, '<', '&lt;');
  result := replace(result, '>', '&gt;');
  result := replace(result, '"', '&quot;');
  result := replace(result, '''', '&#x27;');
  
  -- Step 2: Remove any remaining dangerous patterns (defense in depth)
  -- Remove javascript: protocol (including encoded variants)
  result := regexp_replace(result, '(?i)j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:', '', 'gi');
  result := regexp_replace(result, '(?i)&#0*106;?a', '', 'gi'); -- &#106; = j
  result := regexp_replace(result, '(?i)&#x0*6a;?a', '', 'gi'); -- &#x6a; = j
  
  -- Remove data: protocol
  result := regexp_replace(result, '(?i)d\s*a\s*t\s*a\s*:', '', 'gi');
  
  -- Remove vbscript: protocol
  result := regexp_replace(result, '(?i)v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:', '', 'gi');
  
  -- Remove event handlers (on* attributes) with various whitespace patterns
  result := regexp_replace(result, '(?i)on\w+\s*=', '', 'gi');
  
  -- Remove expression() CSS attacks
  result := regexp_replace(result, '(?i)expression\s*\(', '', 'gi');
  
  -- Remove @import CSS attacks
  result := regexp_replace(result, '(?i)@import', '', 'gi');
  
  -- Remove url() with dangerous protocols
  result := regexp_replace(result, '(?i)url\s*\(\s*[''"]?\s*(javascript|data|vbscript)', '', 'gi');
  
  RETURN result;
END;
$function$;

-- Add rate limiting trigger for report creation
CREATE OR REPLACE FUNCTION public.check_report_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_anonymous_count INTEGER;
  recent_user_count INTEGER;
  user_profile_id UUID;
BEGIN
  -- For anonymous reports, limit to 5 per hour globally (basic DoS protection)
  IF NEW.is_anonymous = true THEN
    SELECT COUNT(*) INTO recent_anonymous_count
    FROM reports
    WHERE is_anonymous = true
    AND created_at > NOW() - INTERVAL '1 hour';
    
    -- Allow up to 100 anonymous reports per hour system-wide
    IF recent_anonymous_count >= 100 THEN
      RAISE EXCEPTION 'System rate limit exceeded for anonymous reports. Please try again later.';
    END IF;
  END IF;
  
  -- For authenticated users, limit to 20 reports per hour per user
  IF NEW.reporter_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_user_count
    FROM reports
    WHERE reporter_user_id = NEW.reporter_user_id
    AND created_at > NOW() - INTERVAL '1 hour';
    
    IF recent_user_count >= 20 THEN
      RAISE EXCEPTION 'Rate limit exceeded. You can only create 20 reports per hour.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS enforce_report_rate_limit ON public.reports;
CREATE TRIGGER enforce_report_rate_limit
BEFORE INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.check_report_rate_limit();

-- Add index for rate limit queries performance
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports (created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_created ON public.reports (reporter_user_id, created_at) WHERE reporter_user_id IS NOT NULL;