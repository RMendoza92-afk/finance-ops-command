-- Make the review-exports bucket private
UPDATE storage.buckets SET public = false WHERE id = 'review-exports';

-- Drop the public read policy
DROP POLICY IF EXISTS "Public read access for review exports" ON storage.objects;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can read review exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'review-exports');

CREATE POLICY "Authenticated users can upload review exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-exports');

CREATE POLICY "Authenticated users can delete review exports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'review-exports');