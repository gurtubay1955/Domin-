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
