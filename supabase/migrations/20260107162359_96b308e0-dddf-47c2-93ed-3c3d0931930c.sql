-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert lor_offers" ON public.lor_offers;

-- Create a new INSERT policy that properly checks for authenticated users
CREATE POLICY "Authenticated users can insert lor_offers" 
ON public.lor_offers 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also fix UPDATE and DELETE to use TO authenticated instead of role check
DROP POLICY IF EXISTS "Authenticated users can update lor_offers" ON public.lor_offers;
CREATE POLICY "Authenticated users can update lor_offers" 
ON public.lor_offers 
FOR UPDATE 
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete lor_offers" ON public.lor_offers;
CREATE POLICY "Authenticated users can delete lor_offers" 
ON public.lor_offers 
FOR DELETE 
TO authenticated
USING (true);