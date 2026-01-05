-- Create claim review tracking table
CREATE TABLE public.claim_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id TEXT NOT NULL,
  area TEXT NOT NULL,
  loss_description TEXT NOT NULL,
  reserves NUMERIC NOT NULL DEFAULT 0,
  low_eval NUMERIC,
  high_eval NUMERIC,
  age_bucket TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_review', 'completed', 'flagged')),
  assigned_to TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claim_reviews ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (public dashboard)
CREATE POLICY "Allow all operations on claim_reviews" 
ON public.claim_reviews 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.claim_reviews;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_claim_reviews_updated_at
BEFORE UPDATE ON public.claim_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();