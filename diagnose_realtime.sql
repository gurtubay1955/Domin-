-- 🕵️ AUDITOR DIAGNOSIS SCRIPT: REALTIME CAPABILITIES
-- OBJETIVO: Verificar si la base de datos soporta flujo "Texas Hold'em" (Broadcasting Inmediato)

-- 1. Verificar configuración de Realtime en Tablas Críticas
-- (Deben estar en la publicación 'supabase_realtime')
select 
    schemaname, 
    tablename, 
    case when exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
        and schemaname = t.schemaname 
        and tablename = t.tablename
    ) then '✅ ENABLED' else '❌ DISABLED' end as realtime_status
from pg_tables t
where schemaname = 'public' 
and tablename in ('matches', 'live_matches', 'app_state', 'tournaments', 'pairs');

-- 2. Verificar Estructura de 'live_matches' (La mesa en vivo)
-- ¿Tiene suficiente detalle para mostrar "qué está pasando"?
select 
    column_name, 
    data_type 
from information_schema.columns 
where table_name = 'live_matches';

-- 3. Verificar estado actual de 'live_matches' (¿Hay basura?)
select * from live_matches;

-- 4. Verificar Políticas RLS (¿Bloquean la escritura rápida?)
select 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd 
from pg_policies 
where tablename in ('live_matches', 'matches');
