-- Create table to track report downloads
CREATE TABLE public.report_downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type TEXT NOT NULL,
  report_name TEXT NOT NULL,
  file_format TEXT NOT NULL DEFAULT 'csv',
  row_count INTEGER,
  metadata JSONB,
  downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow public inserts (no auth required for tracking)
ALTER TABLE public.report_downloads ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (tracking is anonymous)
CREATE POLICY "Allow anonymous inserts" 
ON public.report_downloads 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to read (for admin queries later)
CREATE POLICY "Allow public read" 
ON public.report_downloads 
FOR SELECT 
USING (true);