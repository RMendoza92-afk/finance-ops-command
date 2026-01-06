-- Create storage bucket for review exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-exports', 'review-exports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to review exports
CREATE POLICY "Public read access for review exports"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-exports');

-- Allow authenticated insert for review exports
CREATE POLICY "Allow insert for review exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'review-exports');