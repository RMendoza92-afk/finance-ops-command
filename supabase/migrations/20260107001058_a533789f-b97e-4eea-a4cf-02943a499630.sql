-- Add days_old column to lor_offers for age tracking
ALTER TABLE public.lor_offers 
ADD COLUMN days_old integer DEFAULT NULL;