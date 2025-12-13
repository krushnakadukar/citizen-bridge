-- ============================================
-- Security Fix: RLS Policies for Sensitive Tables
-- ============================================

-- 1. Fix financial_transactions: Restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view transactions" ON public.financial_transactions;

CREATE POLICY "Authenticated users can view transactions" 
ON public.financial_transactions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. Fix report_evidence: Only report owners and officials can add evidence
DROP POLICY IF EXISTS "Anyone can add evidence to reports" ON public.report_evidence;

CREATE POLICY "Report participants can add evidence" 
ON public.report_evidence 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- Report owner can add evidence
    EXISTS (
      SELECT 1 FROM public.reports r 
      WHERE r.id = report_id 
      AND r.reporter_user_id = public.get_profile_id(auth.uid())
    ) 
    -- Or user is official/admin
    OR public.is_official_or_admin(auth.uid())
  )
);

-- 3. Fix storage.objects policies for evidence-media bucket
-- Drop overly permissive storage policies if they exist
DROP POLICY IF EXISTS "Users can view evidence" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view evidence" ON storage.objects;

-- Create restrictive policy: Only report participants can view evidence
CREATE POLICY "Report participants can view evidence" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'evidence-media' AND (
    auth.uid() IS NOT NULL AND (
      -- Check if user is an official/admin (can view all evidence)
      public.is_official_or_admin(auth.uid())
      OR
      -- Check if user owns a report that matches the file path pattern
      EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.reporter_user_id = public.get_profile_id(auth.uid())
        AND name LIKE r.id::text || '/%'
      )
    )
  )
);

-- Create restrictive upload policy
DROP POLICY IF EXISTS "Users can upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload evidence" ON storage.objects;

CREATE POLICY "Report participants can upload evidence" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'evidence-media' AND (
    auth.uid() IS NOT NULL AND (
      -- User is official/admin
      public.is_official_or_admin(auth.uid())
      OR
      -- User owns the report (path starts with report ID they own)
      EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.reporter_user_id = public.get_profile_id(auth.uid())
        AND name LIKE r.id::text || '/%'
      )
    )
  )
);