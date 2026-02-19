-- 🔓 FIX RLS POLICIES FOR GLOBAL SYNC
-- Run this in the Supabase SQL Editor to ensure all devices can READ all matches.

-- 1. ENABLE RLS (Safety Check)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;

-- 2. DROP RESTRICTIVE POLICIES (Clean Slate)
DROP POLICY IF EXISTS "Allow read access for all" ON public.matches;
DROP POLICY IF EXISTS "Allow insert for all" ON public.matches;
DROP POLICY IF EXISTS "Allow read access for all" ON public.pairs;
DROP POLICY IF EXISTS "Allow read access for all" ON public.tournaments;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.live_matches;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.live_matches;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.live_matches;

-- 3. CREATE "OPEN TOURNAMENT" POLICIES
-- NOTE: In a production app with auth, you'd check "auth.uid() IN (SELECT player_id FROM...)"
-- But for this "Highlander" single-tournament model, we want OPEN READ/WRITE for the active session.

-- MATCHES: Everyone needs to see history to calculate stats
CREATE POLICY "Public Read Matches" ON public.matches
FOR SELECT USING (true);

-- Allow anyone to record a match (game clients)
CREATE POLICY "Public Insert Matches" ON public.matches
FOR INSERT WITH CHECK (true);

-- PAIRS: Everyone needs to map IDs to Names
CREATE POLICY "Public Read Pairs" ON public.pairs
FOR SELECT USING (true);

-- TOURNAMENTS: Everyone needs to see host info
CREATE POLICY "Public Read Tournaments" ON public.tournaments
FOR SELECT USING (true);

-- LIVE MATCHES: Everyone needs to see active games (already probably working, but reinforcing)
CREATE POLICY "Public Read Live Matches" ON public.live_matches
FOR SELECT USING (true);

CREATE POLICY "Public Insert Live Matches" ON public.live_matches
FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Delete Live Matches" ON public.live_matches
FOR DELETE USING (true);

-- 4. APP STATE (Config)
DROP POLICY IF EXISTS "Public read app_state" ON public.app_state;
CREATE POLICY "Public Read App State" ON public.app_state
FOR SELECT USING (true);

-- Final Confirmation
SELECT '✅ RLS Policies Updated: GLOBAL VISIBILITY ENABLED' as result;
