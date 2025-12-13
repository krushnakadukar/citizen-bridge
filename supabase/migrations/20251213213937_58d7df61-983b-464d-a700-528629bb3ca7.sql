-- Fix report submission RLS policy to validate reporter_user_id matches authenticated user
-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "Citizens can create reports" ON public.reports;

-- Create a more restrictive INSERT policy
-- For anonymous reports: allow any authenticated or anonymous user
-- For non-anonymous reports: reporter_user_id must match the authenticated user's profile
CREATE POLICY "Users can create own reports or anonymous reports" 
ON public.reports 
FOR INSERT 
WITH CHECK (
  is_anonymous = true 
  OR reporter_user_id IS NULL 
  OR reporter_user_id = get_profile_id(auth.uid())
);

-- Fix notification INSERT policy to prevent abuse
-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a more restrictive INSERT policy that only allows service role
-- This means notifications can only be created via edge functions using the service role
CREATE POLICY "Service role can insert notifications" 
ON public.notifications 
FOR INSERT 
TO service_role
WITH CHECK (true);