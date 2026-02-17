-- Verify and enable real-time for live_matches table (if not already enabled)
-- This should already be done by fix_realtime_matches.sql, but we verify here

-- Check if live_matches is in the realtime publication
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'live_matches';

-- If not present (result is empty), run:
DO $$
BEGIN
    -- Add table to publication if not already there
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'live_matches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE live_matches;
    END IF;
END $$;

-- Ensure permissions are correct
GRANT SELECT ON public.live_matches TO anon;
GRANT SELECT ON public.live_matches TO authenticated;

-- Optional: View all tables in realtime publication
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
