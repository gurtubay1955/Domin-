-- Enable Realtime for the 'tournaments' table (Critical for Host Sync V4.7)
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;

-- Ensure permissions are correct
GRANT SELECT ON public.tournaments TO anon;
GRANT SELECT ON public.tournaments TO authenticated;

-- Optional: Verify existing tables
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
