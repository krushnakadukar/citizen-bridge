-- ============================================
-- Security Fix: Add Input Validation Constraints to reports table
-- ============================================

-- Create validation trigger function instead of CHECK constraints
-- This avoids issues with now() in CHECK constraints and provides better flexibility

CREATE OR REPLACE FUNCTION public.validate_report_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate title length (max 200 characters)
  IF char_length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'Title must be 200 characters or less';
  END IF;

  -- Validate description length (max 10000 characters)
  IF char_length(NEW.description) > 10000 THEN
    RAISE EXCEPTION 'Description must be 10000 characters or less';
  END IF;

  -- Validate location_address length if provided (max 500 characters)
  IF NEW.location_address IS NOT NULL AND char_length(NEW.location_address) > 500 THEN
    RAISE EXCEPTION 'Location address must be 500 characters or less';
  END IF;

  -- Validate category length (max 100 characters)
  IF char_length(NEW.category) > 100 THEN
    RAISE EXCEPTION 'Category must be 100 characters or less';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to validate input on INSERT and UPDATE
DROP TRIGGER IF EXISTS validate_report_input_trigger ON public.reports;
CREATE TRIGGER validate_report_input_trigger
BEFORE INSERT OR UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.validate_report_input();