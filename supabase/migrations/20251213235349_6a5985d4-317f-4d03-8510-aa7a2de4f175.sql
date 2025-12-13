-- Add explicit deny policy for anonymous users on profiles table
-- Defense-in-depth: explicitly deny what should be denied for PII protection

CREATE POLICY "deny_anonymous_access_profiles"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);