
-- 1. Asegurar que la tabla de jugadores existe
CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL UNIQUE,      -- Nombre real (Ej: 'Rodrigo')
    nickname TEXT,               -- Apodo (Ej: 'Rodri')
    avatar_url TEXT,             -- URL de foto
    is_active BOOLEAN DEFAULT true,
    base_points INTEGER DEFAULT 0,  -- Puntos históricos antes de la app
    base_diff INTEGER DEFAULT 0     -- Diferencial histórico antes de la app
);

-- Asegurar políticas de seguridad para la tabla players
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access Players" ON players FOR SELECT USING (true);
CREATE POLICY "Public Insert Access Players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access Players" ON players FOR UPDATE USING (true);

-- 2. Vista Standings Oficiales V3
-- Lógica: [Puntos Base + Semanas Pasadas] + [Puntos Hoy] = [Total]
CREATE OR REPLACE VIEW view_official_standings AS
WITH PlayerStatsPerTournament AS (
    SELECT 
        tournament_id,
        pair_a_names->>0 as player_name,
        1 as attendance,
        CASE WHEN score_a >= 100 THEN 1 ELSE 0 END as win,
        (score_a - score_b) as diff
    FROM matches WHERE (score_a >= 100 OR score_b >= 100) AND pair_a_names->>0 IS NOT NULL
    UNION ALL
    SELECT 
        tournament_id,
        pair_a_names->>1 as player_name,
        1 as attendance,
        CASE WHEN score_a >= 100 THEN 1 ELSE 0 END as win,
        (score_a - score_b) as diff
    FROM matches WHERE (score_a >= 100 OR score_b >= 100) AND pair_a_names->>1 IS NOT NULL
    UNION ALL
    SELECT 
        tournament_id,
        pair_b_names->>0 as player_name,
        1 as attendance,
        CASE WHEN score_b >= 100 THEN 1 ELSE 0 END as win,
        (score_b - score_a) as diff
    FROM matches WHERE (score_a >= 100 OR score_b >= 100) AND pair_b_names->>0 IS NOT NULL
    UNION ALL
    SELECT 
        tournament_id,
        pair_b_names->>1 as player_name,
        1 as attendance,
        CASE WHEN score_b >= 100 THEN 1 ELSE 0 END as win,
        (score_b - score_a) as diff
    FROM matches WHERE (score_a >= 100 OR score_b >= 100) AND pair_b_names->>1 IS NOT NULL
),
LatestTournament AS (
    SELECT id FROM tournaments ORDER BY date DESC, created_at DESC LIMIT 1
),
AggregatedHistory AS (
    SELECT 
        ps.player_name,
        SUM(ps.attendance) as total_attendance,
        SUM(ps.win) as total_wins,
        SUM(ps.diff) as total_diff,
        SUM(CASE WHEN ps.tournament_id = (SELECT id FROM LatestTournament) THEN (ps.attendance + ps.win) ELSE 0 END) as pts_hoy
    FROM PlayerStatsPerTournament ps
    GROUP BY ps.player_name
)
SELECT 
    p.name as player_name,
    (p.base_points + COALESCE(ah.total_attendance, 0) + COALESCE(ah.total_wins, 0) - COALESCE(ah.pts_hoy, 0)) as points_prev,
    COALESCE(ah.pts_hoy, 0) as points_today,
    (p.base_points + COALESCE(ah.total_attendance, 0) + COALESCE(ah.total_wins, 0)) as points_total,
    (p.base_diff + COALESCE(ah.total_diff, 0)) as point_diff
FROM players p
LEFT JOIN AggregatedHistory ah ON p.name = ah.player_name
ORDER BY points_total DESC, point_diff DESC;

-- 3. Vista Calidad V3
CREATE OR REPLACE VIEW view_quality_standings AS
WITH QualityScoring AS (
    SELECT 
        pair_a_names->>0 as player_name,
        CASE 
            WHEN score_a >= 100 AND termination_type = 'double' THEN 3
            WHEN score_a >= 100 AND termination_type = 'single' THEN 2
            WHEN score_a >= 100 THEN 1
            WHEN score_b >= 100 AND termination_type = 'double' THEN -3
            WHEN score_b >= 100 AND termination_type = 'single' THEN -2
            WHEN score_b >= 100 THEN -1
            ELSE 0
        END as quality_pts,
        CASE 
            WHEN score_a >= 100 AND termination_type = 'double' THEN 2
            WHEN score_a >= 100 AND termination_type = 'single' THEN 1
            ELSE 0
        END as shoes
    FROM matches WHERE score_a >= 100 OR score_b >= 100
    UNION ALL
    SELECT 
        pair_a_names->>1 as player_name,
        CASE 
            WHEN score_a >= 100 AND termination_type = 'double' THEN 3
            WHEN score_a >= 100 AND termination_type = 'single' THEN 2
            WHEN score_a >= 100 THEN 1
            WHEN score_b >= 100 AND termination_type = 'double' THEN -3
            WHEN score_b >= 100 AND termination_type = 'single' THEN -2
            WHEN score_b >= 100 THEN -1
            ELSE 0
        END as quality_pts,
        CASE 
            WHEN score_a >= 100 AND termination_type = 'double' THEN 2
            WHEN score_a >= 100 AND termination_type = 'single' THEN 1
            ELSE 0
        END as shoes
    FROM matches WHERE score_a >= 100 OR score_b >= 100
    UNION ALL
    SELECT 
        pair_b_names->>0 as player_name,
        CASE 
            WHEN score_b >= 100 AND termination_type = 'double' THEN 3
            WHEN score_b >= 100 AND termination_type = 'single' THEN 2
            WHEN score_b >= 100 THEN 1
            WHEN score_a >= 100 AND termination_type = 'double' THEN -3
            WHEN score_a >= 100 AND termination_type = 'single' THEN -2
            WHEN score_a >= 100 THEN -1
            ELSE 0
        END as quality_pts,
        CASE 
            WHEN score_b >= 100 AND termination_type = 'double' THEN 2
            WHEN score_b >= 100 AND termination_type = 'single' THEN 1
            ELSE 0
        END as shoes
    FROM matches WHERE score_a >= 100 OR score_b >= 100
    UNION ALL
    SELECT 
        pair_b_names->>1 as player_name,
        CASE 
            WHEN score_b >= 100 AND termination_type = 'double' THEN 3
            WHEN score_b >= 100 AND termination_type = 'single' THEN 2
            WHEN score_b >= 100 THEN 1
            WHEN score_a >= 100 AND termination_type = 'double' THEN -3
            WHEN score_a >= 100 AND termination_type = 'single' THEN -2
            WHEN score_a >= 100 THEN -1
            ELSE 0
        END as quality_pts,
        CASE 
            WHEN score_b >= 100 AND termination_type = 'double' THEN 2
            WHEN score_b >= 100 AND termination_type = 'single' THEN 1
            ELSE 0
        END as shoes
    FROM matches WHERE score_a >= 100 OR score_b >= 100
)
SELECT 
    player_name,
    SUM(quality_pts) as total_quality_points,
    SUM(shoes) as total_shoes
FROM QualityScoring
WHERE player_name IS NOT NULL
GROUP BY player_name
ORDER BY total_quality_points DESC, total_shoes DESC;
