-- Fix RLS policies to allow read access without auth (for domain transfer period)
-- Keep write operations requiring auth for future re-enablement

-- lor_offers table
DROP POLICY IF EXISTS "Authenticated users can view lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Authenticated users can insert lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Authenticated users can update lor_offers" ON public.lor_offers;
DROP POLICY IF EXISTS "Authenticated users can delete lor_offers" ON public.lor_offers;

CREATE POLICY "Anyone can view lor_offers" ON public.lor_offers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert lor_offers" ON public.lor_offers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update lor_offers" ON public.lor_offers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete lor_offers" ON public.lor_offers FOR DELETE USING (auth.role() = 'authenticated');

-- litigation_matters table
DROP POLICY IF EXISTS "Authenticated users can view litigation_matters" ON public.litigation_matters;
DROP POLICY IF EXISTS "Authenticated users can insert litigation_matters" ON public.litigation_matters;
DROP POLICY IF EXISTS "Authenticated users can update litigation_matters" ON public.litigation_matters;
DROP POLICY IF EXISTS "Authenticated users can delete litigation_matters" ON public.litigation_matters;

CREATE POLICY "Anyone can view litigation_matters" ON public.litigation_matters FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert litigation_matters" ON public.litigation_matters FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update litigation_matters" ON public.litigation_matters FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete litigation_matters" ON public.litigation_matters FOR DELETE USING (auth.role() = 'authenticated');

-- open_exposure table
DROP POLICY IF EXISTS "Authenticated users can view open_exposure" ON public.open_exposure;
DROP POLICY IF EXISTS "Authenticated users can insert open_exposure" ON public.open_exposure;
DROP POLICY IF EXISTS "Authenticated users can update open_exposure" ON public.open_exposure;

CREATE POLICY "Anyone can view open_exposure" ON public.open_exposure FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert open_exposure" ON public.open_exposure FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update open_exposure" ON public.open_exposure FOR UPDATE USING (auth.role() = 'authenticated');

-- claim_reviews table
DROP POLICY IF EXISTS "Authenticated users can view claim_reviews" ON public.claim_reviews;
DROP POLICY IF EXISTS "Authenticated users can insert claim_reviews" ON public.claim_reviews;
DROP POLICY IF EXISTS "Authenticated users can update claim_reviews" ON public.claim_reviews;
DROP POLICY IF EXISTS "Authenticated users can delete claim_reviews" ON public.claim_reviews;

CREATE POLICY "Anyone can view claim_reviews" ON public.claim_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert claim_reviews" ON public.claim_reviews FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update claim_reviews" ON public.claim_reviews FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete claim_reviews" ON public.claim_reviews FOR DELETE USING (auth.role() = 'authenticated');

-- inventory_snapshots table
DROP POLICY IF EXISTS "Authenticated users can view inventory_snapshots" ON public.inventory_snapshots;
DROP POLICY IF EXISTS "Authenticated users can insert inventory_snapshots" ON public.inventory_snapshots;
DROP POLICY IF EXISTS "Authenticated users can update inventory_snapshots" ON public.inventory_snapshots;

CREATE POLICY "Anyone can view inventory_snapshots" ON public.inventory_snapshots FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert inventory_snapshots" ON public.inventory_snapshots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update inventory_snapshots" ON public.inventory_snapshots FOR UPDATE USING (auth.role() = 'authenticated');

-- pain_levels table
DROP POLICY IF EXISTS "Authenticated users can view pain_levels" ON public.pain_levels;
DROP POLICY IF EXISTS "Authenticated users can insert pain_levels" ON public.pain_levels;
DROP POLICY IF EXISTS "Authenticated users can update pain_levels" ON public.pain_levels;

CREATE POLICY "Anyone can view pain_levels" ON public.pain_levels FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert pain_levels" ON public.pain_levels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update pain_levels" ON public.pain_levels FOR UPDATE USING (auth.role() = 'authenticated');

-- report_downloads table
DROP POLICY IF EXISTS "Authenticated users can view report_downloads" ON public.report_downloads;
DROP POLICY IF EXISTS "Authenticated users can insert report_downloads" ON public.report_downloads;

CREATE POLICY "Anyone can view report_downloads" ON public.report_downloads FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert report_downloads" ON public.report_downloads FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- reviewers table
DROP POLICY IF EXISTS "Authenticated users can view reviewers" ON public.reviewers;
DROP POLICY IF EXISTS "Authenticated users can insert reviewers" ON public.reviewers;
DROP POLICY IF EXISTS "Authenticated users can update reviewers" ON public.reviewers;
DROP POLICY IF EXISTS "Authenticated users can delete reviewers" ON public.reviewers;

CREATE POLICY "Anyone can view reviewers" ON public.reviewers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert reviewers" ON public.reviewers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update reviewers" ON public.reviewers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete reviewers" ON public.reviewers FOR DELETE USING (auth.role() = 'authenticated');

-- state_bi_limits table
DROP POLICY IF EXISTS "Authenticated users can view state_bi_limits" ON public.state_bi_limits;
DROP POLICY IF EXISTS "Authenticated users can insert state_bi_limits" ON public.state_bi_limits;
DROP POLICY IF EXISTS "Authenticated users can update state_bi_limits" ON public.state_bi_limits;

CREATE POLICY "Anyone can view state_bi_limits" ON public.state_bi_limits FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert state_bi_limits" ON public.state_bi_limits FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update state_bi_limits" ON public.state_bi_limits FOR UPDATE USING (auth.role() = 'authenticated');