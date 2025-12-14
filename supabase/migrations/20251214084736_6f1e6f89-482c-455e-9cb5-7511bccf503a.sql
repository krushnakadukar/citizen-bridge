-- Add UPDATE/DELETE policies for report_comments table
-- Allow users to update their own comments
CREATE POLICY "Users can update own report comments"
ON public.report_comments
FOR UPDATE
USING (author_user_id = get_profile_id(auth.uid()));

-- Allow users to delete their own comments
CREATE POLICY "Users can delete own report comments"
ON public.report_comments
FOR DELETE
USING (author_user_id = get_profile_id(auth.uid()));

-- Allow admins to moderate all report comments
CREATE POLICY "Admins can moderate report comments"
ON public.report_comments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE/DELETE policies for transparency_comments table
-- Allow users to update their own transparency comments
CREATE POLICY "Users can update own transparency comments"
ON public.transparency_comments
FOR UPDATE
USING (user_id = get_profile_id(auth.uid()));

-- Allow users to delete their own transparency comments
CREATE POLICY "Users can delete own transparency comments"
ON public.transparency_comments
FOR DELETE
USING (user_id = get_profile_id(auth.uid()));

-- Allow admins to moderate all transparency comments
CREATE POLICY "Admins can moderate transparency comments"
ON public.transparency_comments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));