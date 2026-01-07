-- Add classification column for Anomaly vs Issue (Loya buckets)
ALTER TABLE public.over_limit_payments 
ADD COLUMN IF NOT EXISTS classification text DEFAULT 'Issue';

-- Add root_cause column for detailed categorization (Holcomb buckets)
ALTER TABLE public.over_limit_payments 
ADD COLUMN IF NOT EXISTS root_cause text;

-- Add comment for clarity
COMMENT ON COLUMN public.over_limit_payments.classification IS 'Loya classification: Anomaly (unavoidable) or Issue (preventable)';
COMMENT ON COLUMN public.over_limit_payments.root_cause IS 'Holcomb root cause bucket: POOR CLAIMS HANDLING, LITIGATED CORRECTLY, ISSUES WITH EXPERT, etc.';