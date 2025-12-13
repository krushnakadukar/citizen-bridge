-- Fix financial_transactions policy - restrict to admins and officials only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.financial_transactions;

-- Create restricted policy for officials and admins only
CREATE POLICY "Officials and admins can view transactions"
ON public.financial_transactions
FOR SELECT
USING (is_official_or_admin(auth.uid()));

-- Strengthen anonymous reports protection
-- Add index on is_anonymous for faster anonymous report queries
CREATE INDEX IF NOT EXISTS idx_reports_anonymous ON public.reports (is_anonymous);

-- Add a comment to document the anonymous report protection
COMMENT ON COLUMN public.reports.is_anonymous IS 'When true, reporter_user_id should be null and report should not be linkable to any user';