-- Create table for storing daily inventory snapshots
CREATE TABLE public.inventory_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  total_claims INTEGER NOT NULL,
  total_reserves NUMERIC NOT NULL DEFAULT 0,
  total_low_eval NUMERIC NOT NULL DEFAULT 0,
  total_high_eval NUMERIC NOT NULL DEFAULT 0,
  cp1_claims INTEGER NOT NULL DEFAULT 0,
  cp1_rate NUMERIC NOT NULL DEFAULT 0,
  no_eval_count INTEGER NOT NULL DEFAULT 0,
  no_eval_reserves NUMERIC NOT NULL DEFAULT 0,
  age_365_plus INTEGER NOT NULL DEFAULT 0,
  age_181_365 INTEGER NOT NULL DEFAULT 0,
  age_61_180 INTEGER NOT NULL DEFAULT 0,
  age_under_60 INTEGER NOT NULL DEFAULT 0,
  type_group_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for read/write access
CREATE POLICY "Allow read access to inventory_snapshots" 
ON public.inventory_snapshots 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert to inventory_snapshots" 
ON public.inventory_snapshots 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update to inventory_snapshots" 
ON public.inventory_snapshots 
FOR UPDATE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_inventory_snapshots_updated_at
BEFORE UPDATE ON public.inventory_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for date lookups
CREATE INDEX idx_inventory_snapshots_date ON public.inventory_snapshots(snapshot_date DESC);