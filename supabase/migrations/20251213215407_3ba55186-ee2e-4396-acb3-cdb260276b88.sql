-- ============================================
-- Security Fix: Add HTML sanitization for comments
-- ============================================

-- Create HTML sanitization function
CREATE OR REPLACE FUNCTION public.sanitize_html(text_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Strip HTML tags and common XSS patterns
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(text_input, '<[^>]*>', '', 'g'),  -- Remove HTML tags
      '(on\w+\s*=)', '', 'gi'  -- Remove event handlers
    ),
    '(javascript:|data:)', '', 'gi'  -- Remove dangerous protocols
  );
END;
$$;

-- Create validation trigger for report_comments
CREATE OR REPLACE FUNCTION public.validate_comment_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Sanitize HTML from content
  NEW.content = sanitize_html(NEW.content);
  
  -- Validate content length (max 5000 characters)
  IF char_length(NEW.content) > 5000 THEN
    RAISE EXCEPTION 'Comment content must be 5000 characters or less';
  END IF;
  
  -- Ensure content is not empty after sanitization
  IF trim(NEW.content) = '' THEN
    RAISE EXCEPTION 'Comment content cannot be empty';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to report_comments
DROP TRIGGER IF EXISTS sanitize_report_comments ON public.report_comments;
CREATE TRIGGER sanitize_report_comments
BEFORE INSERT OR UPDATE ON public.report_comments
FOR EACH ROW
EXECUTE FUNCTION public.validate_comment_content();

-- Create validation trigger for transparency_comments
CREATE OR REPLACE FUNCTION public.validate_transparency_comment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Sanitize HTML from content
  NEW.content = sanitize_html(NEW.content);
  
  -- Validate content length (max 5000 characters)
  IF char_length(NEW.content) > 5000 THEN
    RAISE EXCEPTION 'Comment content must be 5000 characters or less';
  END IF;
  
  -- Ensure content is not empty after sanitization
  IF trim(NEW.content) = '' THEN
    RAISE EXCEPTION 'Comment content cannot be empty';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to transparency_comments
DROP TRIGGER IF EXISTS sanitize_transparency_comments ON public.transparency_comments;
CREATE TRIGGER sanitize_transparency_comments
BEFORE INSERT OR UPDATE ON public.transparency_comments
FOR EACH ROW
EXECUTE FUNCTION public.validate_transparency_comment();

-- ============================================
-- Fix Evidence Storage Policy for Anonymous Reports
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Report participants can view evidence" ON storage.objects;

-- Create improved policy that handles anonymous reports via evidence table join
CREATE POLICY "Report participants can view evidence" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'evidence-media' AND (
    -- Officials and admins can view all evidence
    public.is_official_or_admin(auth.uid())
    OR
    -- Check via evidence table for proper access control
    EXISTS (
      SELECT 1 FROM public.report_evidence re
      JOIN public.reports r ON r.id = re.report_id
      WHERE re.file_url = name
      AND (
        -- Report owner can view their own evidence
        r.reporter_user_id = public.get_profile_id(auth.uid())
      )
    )
  )
);