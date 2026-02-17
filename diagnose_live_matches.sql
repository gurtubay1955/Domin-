-- DIAGNÓSTICO: Verificar estado de live_matches
-- Ejecuta esto en Supabase SQL Editor

-- 1. Ver todas las partidas en vivo (debería haber 2 si Alex y Germán presionaron "A LA MESA")
SELECT * FROM live_matches ORDER BY last_updated DESC;

-- 2. Si está vacío, verificar si real-time está habilitado
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'live_matches';
-- Debe devolver 1 fila. Si está vacío, ejecuta:
-- ALTER PUBLICATION supabase_realtime ADD TABLE live_matches;

-- 3. Verificar permisos
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'live_matches';
-- Debe incluir 'anon' y 'authenticated' con SELECT

-- 4. borrar datos de prueba si es necesario
-- DELETE FROM live_matches WHERE tournament_id = 'TU_TOURNAMENT_ID';
