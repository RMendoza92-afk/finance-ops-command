-- Create CP1 snapshots table for week-over-week tracking
CREATE TABLE public.cp1_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  total_claims INTEGER NOT NULL DEFAULT 0,
  cp1_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  bi_claims INTEGER NOT NULL DEFAULT 0,
  bi_cp1_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_reserves DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_flags INTEGER NOT NULL DEFAULT 0,
  high_risk_claims INTEGER NOT NULL DEFAULT 0,
  age_365_plus INTEGER NOT NULL DEFAULT 0,
  age_181_365 INTEGER NOT NULL DEFAULT 0,
  age_61_180 INTEGER NOT NULL DEFAULT 0,
  age_under_60 INTEGER NOT NULL DEFAULT 0,
  flag_breakdown JSONB DEFAULT '{}',
  coverage_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date)
);

-- Enable Row Level Security
ALTER TABLE public.cp1_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (internal tool)
CREATE POLICY "Allow public read access to cp1_snapshots" 
ON public.cp1_snapshots 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to cp1_snapshots" 
ON public.cp1_snapshots 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to cp1_snapshots" 
ON public.cp1_snapshots 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_cp1_snapshots_updated_at
BEFORE UPDATE ON public.cp1_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for efficient date lookups
CREATE INDEX idx_cp1_snapshots_date ON public.cp1_snapshots(snapshot_date DESC);