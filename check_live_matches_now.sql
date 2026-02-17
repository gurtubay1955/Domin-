-- Verificar qué hay en live_matches AHORA MISMO
SELECT * FROM live_matches 
WHERE id_del_torneo = (
  SELECT value->>'active_tournament_id' 
  FROM app_state 
  WHERE key = 'global_config'
)
ORDER BY last_updated DESC;

-- Verificar si hay suscripciones
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'live_matches';
