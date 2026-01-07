-- Claims frequency tracking table for Loya Insurance Group
CREATE TABLE public.claims_frequency (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer NOT NULL,
  month integer NOT NULL,
  state text NOT NULL,
  reported_claims integer DEFAULT 0,
  in_force integer DEFAULT 0,
  frequency numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(year, month, state)
);

-- Enable RLS
ALTER TABLE public.claims_frequency ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view claims_frequency" ON public.claims_frequency FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert claims_frequency" ON public.claims_frequency FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update claims_frequency" ON public.claims_frequency FOR UPDATE USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_claims_frequency_updated_at BEFORE UPDATE ON public.claims_frequency FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();