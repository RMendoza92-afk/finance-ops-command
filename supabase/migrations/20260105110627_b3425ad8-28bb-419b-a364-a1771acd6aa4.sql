-- Create litigation_matters table
CREATE TABLE public.litigation_matters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id TEXT NOT NULL UNIQUE,
  class TEXT,
  claimant TEXT,
  indemnities_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  type TEXT,
  department TEXT,
  team TEXT,
  discipline TEXT,
  resolution TEXT,
  status TEXT DEFAULT 'Open',
  location TEXT,
  matter_lead TEXT,
  resolution_date DATE,
  filing_date DATE,
  days_open INTEGER DEFAULT 0,
  severity TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pain_levels table
CREATE TABLE public.pain_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES public.litigation_matters(matter_id) ON DELETE CASCADE,
  pain_level TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(matter_id)
);

-- Create open_exposure table for phase/type data
CREATE TABLE public.open_exposure (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES public.litigation_matters(matter_id) ON DELETE CASCADE,
  phase TEXT,
  type_group TEXT,
  net_exposure NUMERIC DEFAULT 0,
  insurance_expectancy NUMERIC DEFAULT 0,
  reserves NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.litigation_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_exposure ENABLE ROW LEVEL SECURITY;

-- Create policies for read access (executives can view all)
CREATE POLICY "Allow read access to litigation_matters" 
ON public.litigation_matters FOR SELECT USING (true);

CREATE POLICY "Allow read access to pain_levels" 
ON public.pain_levels FOR SELECT USING (true);

CREATE POLICY "Allow read access to open_exposure" 
ON public.open_exposure FOR SELECT USING (true);

-- Create policies for insert/update (for data uploads)
CREATE POLICY "Allow insert to litigation_matters" 
ON public.litigation_matters FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update to litigation_matters" 
ON public.litigation_matters FOR UPDATE USING (true);

CREATE POLICY "Allow insert to pain_levels" 
ON public.pain_levels FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update to pain_levels" 
ON public.pain_levels FOR UPDATE USING (true);

CREATE POLICY "Allow delete to pain_levels" 
ON public.pain_levels FOR DELETE USING (true);

CREATE POLICY "Allow insert to open_exposure" 
ON public.open_exposure FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update to open_exposure" 
ON public.open_exposure FOR UPDATE USING (true);

CREATE POLICY "Allow delete to open_exposure" 
ON public.open_exposure FOR DELETE USING (true);

-- Create updated_at triggers
CREATE TRIGGER update_litigation_matters_updated_at
BEFORE UPDATE ON public.litigation_matters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pain_levels_updated_at
BEFORE UPDATE ON public.pain_levels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_open_exposure_updated_at
BEFORE UPDATE ON public.open_exposure
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();