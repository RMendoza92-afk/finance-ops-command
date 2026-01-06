-- Add granular claim data columns to lor_offers
ALTER TABLE public.lor_offers
  ADD COLUMN IF NOT EXISTS bi_phase text DEFAULT 'Pending Demand',
  ADD COLUMN IF NOT EXISTS settlement_status text DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS high_eval numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_eval numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserves numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.lor_offers.bi_phase IS 'BI evaluation phase (e.g., Pending Demand, Active Negotiation, Impasse)';
COMMENT ON COLUMN public.lor_offers.settlement_status IS 'Settlement status: in_progress or settled';
COMMENT ON COLUMN public.lor_offers.high_eval IS 'High evaluation amount';
COMMENT ON COLUMN public.lor_offers.low_eval IS 'Low evaluation amount';
COMMENT ON COLUMN public.lor_offers.reserves IS 'Current reserves on claim';