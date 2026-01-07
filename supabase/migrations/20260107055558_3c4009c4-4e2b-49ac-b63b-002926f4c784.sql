-- Add issue_type column to over_limit_payments to distinguish Anomaly vs Issue
ALTER TABLE public.over_limit_payments 
ADD COLUMN issue_type TEXT DEFAULT 'issue' CHECK (issue_type IN ('anomaly', 'issue'));

-- Create accident_year_development table for loss development by AY
CREATE TABLE public.accident_year_development (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accident_year INTEGER NOT NULL,
  development_months INTEGER NOT NULL,
  as_of_date DATE,
  coverage TEXT NOT NULL DEFAULT 'ALL',
  category TEXT NOT NULL,
  feature_count INTEGER DEFAULT 0,
  prior_reserve NUMERIC DEFAULT 0,
  claim_payment NUMERIC DEFAULT 0,
  salvage_subro NUMERIC DEFAULT 0,
  net_claim_payment NUMERIC DEFAULT 0,
  alae_payment NUMERIC DEFAULT 0,
  reserve_balance NUMERIC DEFAULT 0,
  net_change_reserve NUMERIC DEFAULT 0,
  incurred NUMERIC DEFAULT 0,
  earned_premium NUMERIC DEFAULT 0,
  incurred_pct_premium NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(accident_year, development_months, coverage, category)
);

-- Enable RLS
ALTER TABLE public.accident_year_development ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view accident_year_development"
ON public.accident_year_development
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert accident_year_development"
ON public.accident_year_development
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update accident_year_development"
ON public.accident_year_development
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_accident_year_development_updated_at
BEFORE UPDATE ON public.accident_year_development
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create overspend_summary table for state-level anomaly vs issue breakdown
CREATE TABLE public.overspend_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('anomaly', 'issue')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  claim_count INTEGER DEFAULT 0,
  period_year INTEGER NOT NULL DEFAULT 2025,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(state, issue_type, period_year)
);

-- Enable RLS
ALTER TABLE public.overspend_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view overspend_summary"
ON public.overspend_summary
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert overspend_summary"
ON public.overspend_summary
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update overspend_summary"
ON public.overspend_summary
FOR UPDATE
USING (auth.role() = 'authenticated');