-- Create live_matches table for Realtime Score Updates
-- This table is ephemeral and tracks the state of active games.

CREATE TABLE IF NOT EXISTS public.live_matches (
    tournament_id UUID NOT NULL,
    pair_a INTEGER NOT NULL, -- Pair Number (not UUID) for simpler frontend lookup
    pair_b INTEGER NOT NULL,
    score_a INTEGER DEFAULT 0,
    score_b INTEGER DEFAULT 0,
    hand_number INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite Primary Key ensures one active record per matchup per tournament
    PRIMARY KEY (tournament_id, pair_a, pair_b)
);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE live_matches;

-- Grant access (if needed for anon/authenticated)
GRANT ALL ON public.live_matches TO anon;
GRANT ALL ON public.live_matches TO authenticated;
GRANT ALL ON public.live_matches TO service_role;
