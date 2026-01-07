-- Create claims_payments table for coverage payment tracking
CREATE TABLE public.claims_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coverage TEXT NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  is_ytd BOOLEAN DEFAULT false,
  total_payments NUMERIC DEFAULT 0,
  claimants_paid INTEGER DEFAULT 0,
  avg_paid_per_claimant NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(coverage, period_year, period_month, is_ytd)
);

-- Enable Row Level Security
ALTER TABLE public.claims_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view claims_payments"
ON public.claims_payments
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert claims_payments"
ON public.claims_payments
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update claims_payments"
ON public.claims_payments
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Create over_limit_payments table for tracking payments over policy limits
CREATE TABLE public.over_limit_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_date DATE NOT NULL,
  claim_number TEXT NOT NULL,
  state TEXT NOT NULL,
  policy_limit NUMERIC DEFAULT 0,
  payment_amount NUMERIC NOT NULL,
  over_limit_amount NUMERIC NOT NULL,
  coverage TEXT DEFAULT 'BI',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.over_limit_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view over_limit_payments"
ON public.over_limit_payments
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert over_limit_payments"
ON public.over_limit_payments
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update over_limit_payments"
ON public.over_limit_payments
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete over_limit_payments"
ON public.over_limit_payments
FOR DELETE
USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_claims_payments_updated_at
BEFORE UPDATE ON public.claims_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_over_limit_payments_updated_at
BEFORE UPDATE ON public.over_limit_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();