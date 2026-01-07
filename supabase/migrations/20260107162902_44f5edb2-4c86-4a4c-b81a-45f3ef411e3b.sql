-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can insert lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Authenticated users can update lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Authenticated users can delete lor_offers" ON public.lor_offers;

-- Create public write policies (anyone can insert/update/delete)
CREATE POLICY "Anyone can insert lor_offers" 
ON public.lor_offers 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update lor_offers" 
ON public.lor_offers 
FOR UPDATE 
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can delete lor_offers" 
ON public.lor_offers 
FOR DELETE 
TO anon, authenticated
USING (true);