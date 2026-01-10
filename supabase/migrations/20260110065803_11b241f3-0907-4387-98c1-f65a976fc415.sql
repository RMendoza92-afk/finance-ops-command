-- Fix lor_offers: Remove anonymous access, require authentication
DROP POLICY IF EXISTS "Anyone can insert lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Anyone can update lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Anyone can delete lor_offers" ON public.lor_offers;

CREATE POLICY "Authenticated users can insert lor_offers"
ON public.lor_offers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update lor_offers"
ON public.lor_offers
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete lor_offers"
ON public.lor_offers
FOR DELETE
TO authenticated
USING (true);

-- Fix cp1_snapshots: Remove public access, require authentication
DROP POLICY IF EXISTS "Allow public insert to cp1_snapshots" ON public.cp1_snapshots;
DROP POLICY IF EXISTS "Allow public update to cp1_snapshots" ON public.cp1_snapshots;

CREATE POLICY "Authenticated users can insert cp1_snapshots"
ON public.cp1_snapshots
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update cp1_snapshots"
ON public.cp1_snapshots
FOR UPDATE
TO authenticated
USING (true);