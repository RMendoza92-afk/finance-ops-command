-- Create email recipients table for daily reports
CREATE TABLE public.daily_report_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  report_types TEXT[] DEFAULT ARRAY['inventory', 'cp1', 'budget']::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.daily_report_recipients ENABLE ROW LEVEL SECURITY;

-- Allow public read for the edge function
CREATE POLICY "Allow public read for daily_report_recipients" 
ON public.daily_report_recipients 
FOR SELECT 
USING (true);

-- Allow authenticated users to manage recipients
CREATE POLICY "Authenticated users can manage recipients" 
ON public.daily_report_recipients 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_daily_report_recipients_updated_at
BEFORE UPDATE ON public.daily_report_recipients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();