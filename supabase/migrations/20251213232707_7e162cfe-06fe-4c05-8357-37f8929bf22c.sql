-- Improve storage policies for evidence-media bucket
-- Use direct junction table matching instead of LIKE pattern matching

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Report participants can upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Report participants can view evidence" ON storage.objects;

-- Create improved upload policy using junction table
CREATE POLICY "Secure evidence upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidence-media' AND
  -- Validate filename format: must start with valid UUID
  name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' AND
  -- User must be report owner or official/admin
  (
    is_official_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM reports r
      WHERE r.reporter_user_id = get_profile_id(auth.uid())
      AND r.id::text = split_part(name, '/', 1)
    )
  )
);

-- Create improved view policy using junction table
CREATE POLICY "Secure evidence view"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-media' AND
  (
    is_official_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM report_evidence re
      JOIN reports r ON r.id = re.report_id
      WHERE re.file_url = name
      AND r.reporter_user_id = get_profile_id(auth.uid())
    )
  )
);

-- Create delete policy (admin only)
DROP POLICY IF EXISTS "Admins can delete evidence" ON storage.objects;
CREATE POLICY "Admins can delete evidence"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidence-media' AND
  has_role(auth.uid(), 'admin'::app_role)
);