-- 🚨 PRODUCTION OPTIMIZATION & READINESS 🚨

-- 1. STRATEGIC INDEXING
-- Speed up ticket lookup by DNI and Email (Very common for users)
create index if not exists idx_purchase_requests_query 
on public.purchase_requests (national_id, email);

-- Speed up admin listing of pending requests
create index if not exists idx_purchase_requests_status_created 
on public.purchase_requests (status, created_at desc);

-- Speed up raffle filtering by status
create index if not exists idx_raffles_status 
on public.raffles (status);

-- 2. SECURITY HARDENING (RLS Audit & Fixes)
-- Ensure 'anon' can only insert but not read all requests
-- (Already handled by "Purchase requests viewable by owner" + auth.uid())

-- 3. ERROR HANDLING REFINEMENT
-- This is handled by updating the RPC functions in the next steps.

-- 4. VACUUM & ANALYZE (Informative for User)
-- Note: Supabase handles autovacuum, but it's good practice to analyze after massive index creation.
analyze public.raffle_numbers;
analyze public.purchase_requests;
analyze public.raffles;
