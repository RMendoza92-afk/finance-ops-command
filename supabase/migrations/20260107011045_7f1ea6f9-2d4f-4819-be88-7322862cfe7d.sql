-- Update RLS policies to require authentication

-- =====================
-- claim_reviews table
-- =====================
DROP POLICY IF EXISTS "Allow all operations on claim_reviews" ON public.claim_reviews;

CREATE POLICY "Authenticated users can read claim_reviews"
ON public.claim_reviews
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert claim_reviews"
ON public.claim_reviews
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update claim_reviews"
ON public.claim_reviews
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete claim_reviews"
ON public.claim_reviews
FOR DELETE
TO authenticated
USING (true);

-- =====================
-- inventory_snapshots table
-- =====================
DROP POLICY IF EXISTS "Allow read access to inventory_snapshots" ON public.inventory_snapshots;
DROP POLICY IF EXISTS "Allow insert to inventory_snapshots" ON public.inventory_snapshots;
DROP POLICY IF EXISTS "Allow update to inventory_snapshots" ON public.inventory_snapshots;

CREATE POLICY "Authenticated users can read inventory_snapshots"
ON public.inventory_snapshots
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert inventory_snapshots"
ON public.inventory_snapshots
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory_snapshots"
ON public.inventory_snapshots
FOR UPDATE
TO authenticated
USING (true);

-- =====================
-- litigation_matters table
-- =====================
DROP POLICY IF EXISTS "Allow read access to litigation_matters" ON public.litigation_matters;
DROP POLICY IF EXISTS "Allow insert to litigation_matters" ON public.litigation_matters;
DROP POLICY IF EXISTS "Allow update to litigation_matters" ON public.litigation_matters;

CREATE POLICY "Authenticated users can read litigation_matters"
ON public.litigation_matters
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert litigation_matters"
ON public.litigation_matters
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update litigation_matters"
ON public.litigation_matters
FOR UPDATE
TO authenticated
USING (true);

-- =====================
-- lor_offers table
-- =====================
DROP POLICY IF EXISTS "Allow read access to lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Allow insert to lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Allow update to lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Allow delete to lor_offers" ON public.lor_offers;

CREATE POLICY "Authenticated users can read lor_offers"
ON public.lor_offers
FOR SELECT
TO authenticated
USING (true);

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

-- =====================
-- open_exposure table
-- =====================
DROP POLICY IF EXISTS "Allow read access to open_exposure" ON public.open_exposure;
DROP POLICY IF EXISTS "Allow insert to open_exposure" ON public.open_exposure;
DROP POLICY IF EXISTS "Allow update to open_exposure" ON public.open_exposure;
DROP POLICY IF EXISTS "Allow delete to open_exposure" ON public.open_exposure;

CREATE POLICY "Authenticated users can read open_exposure"
ON public.open_exposure
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert open_exposure"
ON public.open_exposure
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update open_exposure"
ON public.open_exposure
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete open_exposure"
ON public.open_exposure
FOR DELETE
TO authenticated
USING (true);

-- =====================
-- pain_levels table
-- =====================
DROP POLICY IF EXISTS "Allow read access to pain_levels" ON public.pain_levels;
DROP POLICY IF EXISTS "Allow insert to pain_levels" ON public.pain_levels;
DROP POLICY IF EXISTS "Allow update to pain_levels" ON public.pain_levels;
DROP POLICY IF EXISTS "Allow delete to pain_levels" ON public.pain_levels;

CREATE POLICY "Authenticated users can read pain_levels"
ON public.pain_levels
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert pain_levels"
ON public.pain_levels
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update pain_levels"
ON public.pain_levels
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete pain_levels"
ON public.pain_levels
FOR DELETE
TO authenticated
USING (true);

-- =====================
-- report_downloads table
-- =====================
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.report_downloads;
DROP POLICY IF EXISTS "Allow public read" ON public.report_downloads;

CREATE POLICY "Authenticated users can read report_downloads"
ON public.report_downloads
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert report_downloads"
ON public.report_downloads
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================
-- reviewers table
-- =====================
DROP POLICY IF EXISTS "Allow read access to reviewers" ON public.reviewers;
DROP POLICY IF EXISTS "Allow insert to reviewers" ON public.reviewers;
DROP POLICY IF EXISTS "Allow update to reviewers" ON public.reviewers;
DROP POLICY IF EXISTS "Allow delete to reviewers" ON public.reviewers;

CREATE POLICY "Authenticated users can read reviewers"
ON public.reviewers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert reviewers"
ON public.reviewers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update reviewers"
ON public.reviewers
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete reviewers"
ON public.reviewers
FOR DELETE
TO authenticated
USING (true);

-- =====================
-- state_bi_limits table (read-only for authenticated users)
-- =====================
DROP POLICY IF EXISTS "Allow read access to state_bi_limits" ON public.state_bi_limits;

CREATE POLICY "Authenticated users can read state_bi_limits"
ON public.state_bi_limits
FOR SELECT
TO authenticated
USING (true);