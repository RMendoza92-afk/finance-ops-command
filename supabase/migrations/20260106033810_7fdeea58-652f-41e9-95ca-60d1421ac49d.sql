-- Create reviewers table
CREATE TABLE public.reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviewers ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read reviewers
CREATE POLICY "Allow read access to reviewers"
ON public.reviewers
FOR SELECT
USING (true);

-- Allow all operations for now (can restrict later)
CREATE POLICY "Allow insert to reviewers"
ON public.reviewers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update to reviewers"
ON public.reviewers
FOR UPDATE
USING (true);

CREATE POLICY "Allow delete to reviewers"
ON public.reviewers
FOR DELETE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_reviewers_updated_at
BEFORE UPDATE ON public.reviewers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing reviewers
INSERT INTO public.reviewers (name, phone, email) VALUES
  ('Victor Cruz', '+15555550101', 'victor.cruz@company.com'),
  ('Sarah Mitchell', '+15555550102', 'sarah.mitchell@company.com'),
  ('James Patterson', '+15555550103', 'james.patterson@company.com'),
  ('Maria Santos', '+15555550104', 'maria.santos@company.com'),
  ('Robert Chen', '+15555550105', 'robert.chen@company.com');