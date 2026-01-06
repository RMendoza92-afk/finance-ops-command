-- Create LOR intervention offers table
CREATE TABLE public.lor_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_number TEXT NOT NULL,
  accident_description TEXT,
  area TEXT,
  offer_amount NUMERIC NOT NULL,
  extended_date DATE NOT NULL,
  expires_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  outcome_date DATE,
  outcome_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lor_offers ENABLE ROW LEVEL SECURITY;

-- Create policies for full access (internal tool)
CREATE POLICY "Allow read access to lor_offers" 
ON public.lor_offers 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert to lor_offers" 
ON public.lor_offers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update to lor_offers" 
ON public.lor_offers 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete to lor_offers" 
ON public.lor_offers 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_lor_offers_updated_at
BEFORE UPDATE ON public.lor_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the existing offer
INSERT INTO public.lor_offers (claim_number, accident_description, area, offer_amount, extended_date, expires_date, status)
VALUES ('65-0000558113', 'Lane Change / Side Swipe', 'Houston', 7500, '2025-12-30', '2026-01-14', 'pending');