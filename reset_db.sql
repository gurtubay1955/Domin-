-- Script para reiniciar la base de datos (Borrado Lógico/Físico)

-- Borrar datos de partidos y manos
TRUNCATE TABLE hands CASCADE;
TRUNCATE TABLE matches CASCADE;

-- Reiniciar conteo de jornadas (opcional, si se quiere borrar todo)
-- TRUNCATE TABLE jornadas CASCADE;

-- Resetear flags de jugadores (si los hubiera)
UPDATE players SET current_status = 'offline';

-- NOTA: Esto no borra los jugadores en sí, solo el historial de juego.
