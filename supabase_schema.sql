-- 🏗️ ESQUEMA DE BASE DE DATOS PITOMATE V2.0 (SUPABASE)

-- 1. PLAYERS (Maestro de Jugadores)
CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,          -- Nombre real (Ej: 'Rodrigo')
    nickname TEXT,               -- Apodo (Ej: 'Rodri')
    avatar_url TEXT,             -- URL de foto
    is_active BOOLEAN DEFAULT true
);

-- 2. TOURNAMENTS (Las Jornadas)
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE NOT NULL,          -- Fecha del torneo
    host_name TEXT NOT NULL,     -- Nombre del anfitrión (Ej: 'Rodrigo')
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'finished')),
    metadata JSONB               -- Configuración extra
);

-- 3. PAIRS (Parejas generadas por sorteo)
CREATE TABLE IF NOT EXISTS pairs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    player1_name TEXT NOT NULL,  -- Guardamos nombres strings por simplicidad inicial
    player2_name TEXT NOT NULL,
    pair_number INTEGER NOT NULL -- 1 a 8
);

-- 4. MATCHES (Partidas y Resultados)
CREATE TABLE IF NOT EXISTS matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    
    -- Identificación de Parejas (Referencia ID o número)
    pair_a_id UUID REFERENCES pairs(id),
    pair_b_id UUID REFERENCES pairs(id),
    
    -- Nombres (Snapshots para historial inmutable)
    pair_a_names JSONB NOT NULL, -- ["Rodri", "Paco"]
    pair_b_names JSONB NOT NULL, -- ["Beto", "Alex"]

    -- Puntuación Final
    score_a INTEGER NOT NULL DEFAULT 0,
    score_b INTEGER NOT NULL DEFAULT 0,

    -- 📊 ESTADÍSTICAS AVANZADAS (NUEVO)
    hands_a INTEGER DEFAULT 0,   -- Manos ganadas por Pareja A
    hands_b INTEGER DEFAULT 0,   -- Manos ganadas por Pareja B
    
    -- Tipo de Victoria (Calculado)
    -- 'double' (100-0), 'single' (100-50), 'none' (Normal)
    -- Guardamos el status desde la perspectiva del GANADOR o global
    termination_type TEXT CHECK (termination_type IN ('none', 'single', 'double')),
    
    duration_seconds INTEGER,    -- Duración de la partida
    winner_pair UUID,            -- ID de la pareja ganadora (opcional, redundante pero útil)
    timestamp BIGINT             -- Timestamp original del cliente
);

-- 5. POLÍTICAS DE SEGURIDAD (RLS)
-- Permitir lectura pública (anon) y escritura autenticada (usaremos anon key por ahora para simplificar)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Política ABIERTA para desarrollo (CUIDADO: Cambiar en producción)
CREATE POLICY "Public Read Access" ON players FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON pairs FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON matches FOR SELECT USING (true);

CREATE POLICY "Public Insert Access" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Access" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Access" ON pairs FOR INSERT WITH CHECK (true);

-- 6. LIVE MATCHES (Marcadores en Tiempo Real)
-- Tabla volátil para mostrar "Jugando: 85-90"
CREATE TABLE IF NOT EXISTS live_matches (
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    pair_a INTEGER NOT NULL, -- Número de pareja (menor)
    pair_b INTEGER NOT NULL, -- Número de pareja (mayor)
    score_a INTEGER DEFAULT 0,
    score_b INTEGER DEFAULT 0,
    hand_number INTEGER DEFAULT 1,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    PRIMARY KEY (tournament_id, pair_a, pair_b),
    CONSTRAINT pair_order CHECK (pair_a < pair_b) -- Normalización forzada
);

ALTER TABLE live_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON live_matches FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON live_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON live_matches FOR UPDATE USING (true);

-- 7. APP STATE (Singleton for Multiplayer Sync)
-- "La Señal Maestra"
CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value JSONB, -- Flexible payload (e.g. { "active_tournament_id": "uuid" })
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON app_state FOR SELECT USING (true);
CREATE POLICY "Public Update Access" ON app_state FOR UPDATE USING (true);
CREATE POLICY "Public Insert Access" ON app_state FOR INSERT WITH CHECK (true);

-- Seed with default null state
INSERT INTO app_state (key, value) VALUES ('global_config', '{"active_tournament_id": null}'::jsonb) ON CONFLICT DO NOTHING;
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
-- ==============================================================================
-- 🚀 MIGRACIÓN: CORRECCIÓN A LEADERBOARD INDIVIDUAL (STANDINGS) V2.0
-- ==============================================================================

-- 1️⃣ Vista de Standings INDIVIDUAL (Player Level)
-- El Torneo Pitomate evalúa a los jugadores individualmente, no a las parejas, 
-- porque las parejas cambian. Un jugador recibe +1 punto por jornada asistida, 
-- y +1 punto por partida ganada.

CREATE OR REPLACE VIEW view_player_standings AS
WITH PlayerMatchStats AS (
    -- Extraer Jugador 1 de Pair A
    SELECT 
        m.tournament_id,
        m.pair_a_names->>0 AS player_name,
        CASE WHEN m.score_a >= 100 THEN 1 ELSE 0 END AS win,
        CASE WHEN m.termination_type = 'double' AND m.score_a >= 100 THEN 1 ELSE 0 END AS gave_double_shoe,
        CASE WHEN m.termination_type = 'double' AND m.score_b >= 100 THEN 1 ELSE 0 END AS received_double_shoe,
        m.score_a AS points_scored,
        m.score_b AS points_allowed
    FROM matches m WHERE (m.score_a >= 100 OR m.score_b >= 100) AND m.pair_a_names->>0 IS NOT NULL
    
    UNION ALL
    
    -- Extraer Jugador 2 de Pair A
    SELECT 
        m.tournament_id,
        m.pair_a_names->>1 AS player_name,
        CASE WHEN m.score_a >= 100 THEN 1 ELSE 0 END AS win,
        CASE WHEN m.termination_type = 'double' AND m.score_a >= 100 THEN 1 ELSE 0 END AS gave_double_shoe,
        CASE WHEN m.termination_type = 'double' AND m.score_b >= 100 THEN 1 ELSE 0 END AS received_double_shoe,
        m.score_a AS points_scored,
        m.score_b AS points_allowed
    FROM matches m WHERE (m.score_a >= 100 OR m.score_b >= 100) AND m.pair_a_names->>1 IS NOT NULL

    UNION ALL
    
    -- Extraer Jugador 1 de Pair B
    SELECT 
        m.tournament_id,
        m.pair_b_names->>0 AS player_name,
        CASE WHEN m.score_b >= 100 THEN 1 ELSE 0 END AS win,
        CASE WHEN m.termination_type = 'double' AND m.score_b >= 100 THEN 1 ELSE 0 END AS gave_double_shoe,
        CASE WHEN m.termination_type = 'double' AND m.score_a >= 100 THEN 1 ELSE 0 END AS received_double_shoe,
        m.score_b AS points_scored,
        m.score_a AS points_allowed
    FROM matches m WHERE (m.score_a >= 100 OR m.score_b >= 100) AND m.pair_b_names->>0 IS NOT NULL

    UNION ALL
    
    -- Extraer Jugador 2 de Pair B
    SELECT 
        m.tournament_id,
        m.pair_b_names->>1 AS player_name,
        CASE WHEN m.score_b >= 100 THEN 1 ELSE 0 END AS win,
        CASE WHEN m.termination_type = 'double' AND m.score_b >= 100 THEN 1 ELSE 0 END AS gave_double_shoe,
        CASE WHEN m.termination_type = 'double' AND m.score_a >= 100 THEN 1 ELSE 0 END AS received_double_shoe,
        m.score_b AS points_scored,
        m.score_a AS points_allowed
    FROM matches m WHERE (m.score_a >= 100 OR m.score_b >= 100) AND m.pair_b_names->>1 IS NOT NULL
),
TournamentAttendance AS (
    -- Cuenta distintos torneos jugados por cada jugador para los "Puntos de Asistencia" (1 por torneo)
    SELECT player_name, COUNT(DISTINCT tournament_id) AS tournaments_attended
    FROM PlayerMatchStats
    GROUP BY player_name
),
AggregatedStats AS (
    SELECT 
        pms.player_name,
        COUNT(*) AS total_matches,
        SUM(pms.win) AS total_wins,
        (COUNT(*) - SUM(pms.win)) AS total_losses,
        SUM(pms.points_scored) AS total_points_scored,
        SUM(pms.points_allowed) AS total_points_allowed,
        (SUM(pms.points_scored) - SUM(pms.points_allowed)) AS point_diff,
        SUM(pms.gave_double_shoe) AS zapateros_dados,
        SUM(pms.received_double_shoe) AS zapateros_recibidos
    FROM PlayerMatchStats pms
    GROUP BY pms.player_name
)
SELECT 
    a.player_name,
    t.tournaments_attended,
    a.total_matches,
    a.total_wins,
    a.total_losses,
    
    -- RULE: 1 Punto por asistir al torneo + 1 Punto por cada victoria.
    -- TODO: En un sistema 100% dinámico, esto se cruzaría con `tournament_rules`. 
    -- Para esta vista optimizada asume la regla actual del cliente.
    (t.tournaments_attended + a.total_wins) AS total_championship_points,
    
    a.total_points_scored,
    a.total_points_allowed,
    a.point_diff,
    a.zapateros_dados,
    a.zapateros_recibidos
FROM AggregatedStats a
JOIN TournamentAttendance t ON a.player_name = t.player_name
ORDER BY total_championship_points DESC, a.point_diff DESC;
