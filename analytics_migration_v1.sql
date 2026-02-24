-- ==============================================================================
-- 🚀 MIGRACIÓN: SISTEMA DE ANALÍTICAS AVANZADAS Y PUNTUACIÓN DE CAMPEONATO V1.0
-- ==============================================================================

-- 1️⃣ NUEVA TABLA: TOURNAMENT RULES (Reglas Flexibles de Puntuación)
-- Permite que cada torneo (o temporada) tenga reglas distintas de puntos sin alterar el pasado.
CREATE TABLE IF NOT EXISTS tournament_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL, -- Ej: 'Reglas Oficiales V1', 'Reglas con Bono de Zapatero'
    
    -- Configuración de Puntos
    points_for_win INTEGER DEFAULT 1,
    points_for_attendance INTEGER DEFAULT 1,
    
    -- Umbrales y Puntos Extras (Zapateros)
    threshold_single_shoe INTEGER DEFAULT 50, -- Si el perdedor anota <= 50
    points_for_double_shoe INTEGER DEFAULT 3, -- 100 a 0
    points_for_single_shoe INTEGER DEFAULT 2, -- 100 a <= 50 (pero > 0)
    
    is_active BOOLEAN DEFAULT false -- Solo una regla debería estar activa por defecto para nuevos torneos
);

ALTER TABLE tournament_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON tournament_rules FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON tournament_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON tournament_rules FOR UPDATE USING (true);

-- Insertar regla por defecto (La actual del cliente)
INSERT INTO tournament_rules (name, points_for_win, points_for_attendance, points_for_double_shoe, points_for_single_shoe, is_active)
VALUES ('Regla Base (1 por Ganar, 1 Asistencia)', 1, 1, 3, 2, true);

-- Vincular Reglas al Torneo (Si no tiene, heredará la activa)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rules_id UUID REFERENCES tournament_rules(id);


-- 2️⃣ NUEVA TABLA: MATCH HANDS (Granularidad Mano a Mano)
-- Para medir el Índice de Fricción, Rachas y Remontadas
CREATE TABLE IF NOT EXISTS match_hands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    hand_number INTEGER NOT NULL,
    score_a INTEGER NOT NULL DEFAULT 0,
    score_b INTEGER NOT NULL DEFAULT 0,
    
    points_earned_a INTEGER NOT NULL DEFAULT 0, -- Cuántos puntos hicieron en ESTA mano
    points_earned_b INTEGER NOT NULL DEFAULT 0,
    
    winner_team CHAR(1) CHECK (winner_team IN ('A', 'B', 'T')), -- 'T' para Tranca (Empate sin puntos o pase)
    
    UNIQUE (match_id, hand_number)
);

ALTER TABLE match_hands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON match_hands FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON match_hands FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON match_hands FOR UPDATE USING (true);


-- 3️⃣ MODIFICACIÓN TABLA MATCHES
-- Guardar estáticamente los puntos del campeonato para que no se recalculen si las reglas cambian
ALTER TABLE matches ADD COLUMN IF NOT EXISTS championship_points_a INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS championship_points_b INTEGER DEFAULT 0;

-- 4️⃣ VISTAS DE ANALÍTICA (DOMINO ANALYTICS)

-- Vista: "Índice de Fricción" (Estadísticas por Partida)
-- Cuántas manos duró, punto promedio por mano, etc.
CREATE OR REPLACE VIEW view_match_analytics AS
SELECT 
    m.id AS match_id,
    m.tournament_id,
    m.pair_a_names,
    m.pair_b_names,
    m.score_a,
    m.score_b,
    m.termination_type,
    
    -- Índice de Fricción
    (SELECT COUNT(*) FROM match_hands mh WHERE mh.match_id = m.id) AS total_hands_played,
    
    -- Eficiencia Ofensiva (PPM: Puntos por Mano promediados de los ganadores)
    CASE 
        WHEN m.score_a >= 100 THEN (m.score_a::FLOAT / NULLIF((SELECT COUNT(*) FROM match_hands mh WHERE mh.match_id = m.id AND mh.winner_team = 'A'), 0))
        WHEN m.score_b >= 100 THEN (m.score_b::FLOAT / NULLIF((SELECT COUNT(*) FROM match_hands mh WHERE mh.match_id = m.id AND mh.winner_team = 'B'), 0))
        ELSE 0 
    END AS winner_ppm,

    -- Puntos de Campeonato
    m.championship_points_a,
    m.championship_points_b

FROM matches m
WHERE m.score_a >= 100 OR m.score_b >= 100; -- Solo partidas finalizadas


-- Vista: Leaderboard Oficial con Puntos de Campeonato (Standings Reales)
-- Esta vista suma los puntos estáticos guardados en cada 'match' para construir la tabla de posiciones
CREATE OR REPLACE VIEW view_leaderboard_standings AS
WITH TeamStats AS (
    -- Desglosamos Pair A
    SELECT 
        m.tournament_id,
        m.pair_a_id AS pair_id,
        m.pair_a_names AS pair_names,
        m.championship_points_a AS pts_earned,
        m.score_a AS points_scored,
        m.score_b AS points_allowed,
        CASE WHEN m.score_a >= 100 THEN 1 ELSE 0 END AS win,
        CASE WHEN m.termination_type = 'double' AND m.score_a >= 100 THEN 1 ELSE 0 END AS double_shoes_given,
        CASE WHEN m.termination_type = 'double' AND m.score_b >= 100 THEN 1 ELSE 0 END AS double_shoes_received
    FROM matches m WHERE (m.score_a >= 100 OR m.score_b >= 100)
    
    UNION ALL
    
    -- Desglosamos Pair B
    SELECT 
        m.tournament_id,
        m.pair_b_id AS pair_id,
        m.pair_b_names AS pair_names,
        m.championship_points_b AS pts_earned,
        m.score_b AS points_scored,
        m.score_a AS points_allowed,
        CASE WHEN m.score_b >= 100 THEN 1 ELSE 0 END AS win,
        CASE WHEN m.termination_type = 'double' AND m.score_b >= 100 THEN 1 ELSE 0 END AS double_shoes_given,
        CASE WHEN m.termination_type = 'double' AND m.score_a >= 100 THEN 1 ELSE 0 END AS double_shoes_received
    FROM matches m WHERE (m.score_a >= 100 OR m.score_b >= 100)
)
SELECT 
    tournament_id,
    pair_id,
    pair_names,
    COUNT(*) AS matches_played,
    SUM(win) AS matches_won,
    SUM(pts_earned) AS total_championship_points,
    SUM(points_scored) AS total_points_scored,
    SUM(points_allowed) AS total_points_allowed,
    (SUM(points_scored) - SUM(points_allowed)) AS point_differential,
    SUM(double_shoes_given) AS double_shoes_given,
    SUM(double_shoes_received) AS double_shoes_received
FROM TeamStats
GROUP BY tournament_id, pair_id, pair_names
ORDER BY total_championship_points DESC, point_differential DESC;
