-- Enable Realtime for the 'matches' table (Critical for Sync)
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- Enable Realtime for 'app_state' (Critical for Global Config)
ALTER PUBLICATION supabase_realtime ADD TABLE app_state;

-- Ensure permissions are correct
GRANT SELECT ON public.matches TO anon;
GRANT SELECT ON public.matches TO authenticated;
GRANT SELECT ON public.app_state TO anon;
GRANT SELECT ON public.app_state TO authenticated;

-- Optional: Verify existing tables
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
