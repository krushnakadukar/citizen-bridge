-- Add server-side rate limiting for report comments
CREATE OR REPLACE FUNCTION public.check_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Check comments in last 10 minutes by this user
  SELECT COUNT(*) INTO recent_count
  FROM report_comments
  WHERE author_user_id = NEW.author_user_id
  AND created_at > NOW() - INTERVAL '10 minutes';
  
  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 20 comments per 10 minutes.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for report_comments
DROP TRIGGER IF EXISTS enforce_comment_rate_limit ON public.report_comments;
CREATE TRIGGER enforce_comment_rate_limit
BEFORE INSERT ON public.report_comments
FOR EACH ROW
EXECUTE FUNCTION public.check_comment_rate_limit();

-- Add server-side rate limiting for transparency comments
CREATE OR REPLACE FUNCTION public.check_transparency_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Check transparency comments in last 10 minutes by this user
  SELECT COUNT(*) INTO recent_count
  FROM transparency_comments
  WHERE user_id = NEW.user_id
  AND created_at > NOW() - INTERVAL '10 minutes';
  
  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 20 comments per 10 minutes.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for transparency_comments
DROP TRIGGER IF EXISTS enforce_transparency_comment_rate_limit ON public.transparency_comments;
CREATE TRIGGER enforce_transparency_comment_rate_limit
BEFORE INSERT ON public.transparency_comments
FOR EACH ROW
EXECUTE FUNCTION public.check_transparency_comment_rate_limit();

-- Add indexes for rate limit query performance
CREATE INDEX IF NOT EXISTS idx_report_comments_author_created 
ON public.report_comments (author_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_transparency_comments_user_created 
ON public.transparency_comments (user_id, created_at);