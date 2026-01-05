-- Create state BI limits reference table
CREATE TABLE public.state_bi_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  limit_2022 NUMERIC DEFAULT 0,
  limit_2023 NUMERIC DEFAULT 0,
  limit_2025 NUMERIC DEFAULT 0,
  trigger_80_pct NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.state_bi_limits ENABLE ROW LEVEL SECURITY;

-- Public read access (reference data)
CREATE POLICY "Allow read access to state_bi_limits" 
ON public.state_bi_limits 
FOR SELECT 
USING (true);

-- Insert all state data
INSERT INTO public.state_bi_limits (state, limit_2022, limit_2023, limit_2025, trigger_80_pct, notes) VALUES
('Alabama', 25000, 25000, 25000, 20000, NULL),
('Alaska', 50000, 50000, 50000, 40000, NULL),
('Arizona', 25000, 25000, 25000, 20000, NULL),
('Arkansas', 25000, 25000, 25000, 20000, NULL),
('California', 15000, 15000, 30000, 24000, 'SB1107 effective 1/1/2025'),
('Colorado', 25000, 25000, 25000, 20000, NULL),
('Connecticut', 25000, 25000, 25000, 20000, NULL),
('Delaware', 25000, 25000, 25000, 20000, NULL),
('District of Columbia', 25000, 25000, 25000, 20000, NULL),
('Florida', NULL, NULL, NULL, NULL, 'No BI mandate; PIP/PDL regime'),
('Georgia', 25000, 25000, 25000, 20000, NULL),
('Hawaii', 20000, 20000, 20000, 16000, NULL),
('Idaho', 25000, 25000, 25000, 20000, NULL),
('Illinois', 25000, 25000, 25000, 20000, NULL),
('Indiana', 25000, 25000, 25000, 20000, NULL),
('Iowa', 20000, 20000, 20000, 16000, NULL),
('Kansas', 25000, 25000, 25000, 20000, NULL),
('Kentucky', 25000, 25000, 25000, 20000, NULL),
('Louisiana', 15000, 15000, 15000, 12000, NULL),
('Maine', 50000, 50000, 50000, 40000, NULL),
('Maryland', 30000, 30000, 30000, 24000, NULL),
('Massachusetts', 20000, 20000, 20000, 16000, NULL),
('Michigan', 50000, 50000, 50000, 40000, NULL),
('Minnesota', 30000, 30000, 30000, 24000, NULL),
('Mississippi', 25000, 25000, 25000, 20000, NULL),
('Missouri', 25000, 25000, 25000, 20000, NULL),
('Montana', 25000, 25000, 25000, 20000, NULL),
('Nebraska', 25000, 25000, 25000, 20000, NULL),
('Nevada', 25000, 25000, 25000, 20000, NULL),
('New Hampshire', 25000, 25000, 25000, 20000, 'Optional; 25/50/25 if insured'),
('New Jersey', 15000, 25000, 25000, 20000, 'Standard policy raised in 2023; Basic policy may have 0 BI'),
('New Mexico', 25000, 25000, 25000, 20000, NULL),
('New York', 25000, 25000, 25000, 20000, NULL),
('North Carolina', 30000, 30000, 50000, 40000, 'Increase effective 7/1/2025'),
('North Dakota', 25000, 25000, 25000, 20000, NULL),
('Ohio', 25000, 25000, 25000, 20000, NULL),
('Oklahoma', 25000, 25000, 25000, 20000, NULL),
('Oregon', 25000, 25000, 25000, 20000, NULL),
('Pennsylvania', 15000, 15000, 15000, 12000, NULL),
('Rhode Island', 25000, 25000, 25000, 20000, NULL),
('South Carolina', 25000, 25000, 25000, 20000, NULL),
('South Dakota', 25000, 25000, 25000, 20000, NULL),
('Tennessee', 25000, 25000, 25000, 20000, NULL),
('Texas', 30000, 30000, 30000, 24000, NULL),
('Utah', 25000, 25000, 25000, 20000, NULL),
('Vermont', 25000, 25000, 25000, 20000, NULL),
('Virginia', 30000, 30000, 50000, 40000, 'Increase effective 1/1/2025'),
('Washington', 25000, 25000, 25000, 20000, NULL),
('West Virginia', 25000, 25000, 25000, 20000, NULL),
('Wisconsin', 25000, 25000, 25000, 20000, NULL),
('Wyoming', 25000, 25000, 25000, 20000, NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_state_bi_limits_updated_at
BEFORE UPDATE ON public.state_bi_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();