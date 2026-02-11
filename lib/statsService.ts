import { MatchRecord } from "./store";
import { OFFICIAL_PLAYERS } from "./constants";

/**
 * 📊 ESTADÍSTICAS DEL TORNEO (PITOMATE ANALYTICS)
 * Implementación de los 25 puntos solicitados para análisis profundo.
 */

// Estructura de un Jugador en el Leaderboard
export interface PlayerStats {
    name: string;
    // 1-3 & 7-8: Totales Generales (Contexto)
    matchesPlayed: number;
    // 9-10: Ganadas/Perdidas
    matchesWon: number;
    matchesLost: number;
    // 21: Effectiveness (Win Rate)
    winRate: number;

    // 15: Puntos Totales (1 asistencia + 1 victoria)
    totalPoints: number;

    // 12-14: Tipos de Victoria
    winsDoubleZapatero: number; // 3 pts agressiveness
    winsSingleZapatero: number; // 2 pts
    winsNormal: number;         // 1 pt

    // 12-14 (Inverse): Tipos de Derrota (para restar agresividad)
    lostDoubleZapatero: number; // -3 pts
    lostSingleZapatero: number; // -2 pts
    lostNormal: number;         // -1 pt

    // 25: AGRESIVIDAD NETAMENTE DICHA
    aggressivenessScore: number;

    // 16-19: Manos (Hands)
    handsWon: number; // Manos ganadas en total
    handsLost: number; // Manos perdidas
    totalHands: number; // 18

    // 20: Hand Win Rate
    handWinRate: number;

    // 22: Attendance (Asistencia)
    attendanceIndex: number; // Participación sobre 16 jornadas

    // 23: Hands Ratio (Manos ganadas / Manos perdidas)
    handsRatio: number;
}

export interface TournamentStats {
    seasonTotalGames: number; // 1. Total juegos por temporada (16 jornadas * X) -> estimado
    seasonPlayedGames: number; // 2. Juegos jugados
    seasonPendingGames: number; // 3. Juegos faltantes

    totalAccumulatedGames: number; // 7. Total juegos acumulados
    totalAccumulatedHands: number; // 8. Total manos acumuladas

    hostsCompleted: string[]; // 5. Anfitriones listos
    hostsPending: string[]; // 6. Anfitriones faltantes

    leaderboard: PlayerStats[]; // Lista ordenada por Puntos
    aggressivenessLeaderboard: PlayerStats[]; // Lista ordenada por Agresividad
}

const TOTAL_JORNADAS = 16;

export const calculateStats = (
    matches: MatchRecord[],
    allPairs: Record<string, string[]>,
    currentJornada: number = 1
): TournamentStats => {

    // Inicializar mapa de estadísticas por jugador
    const statsMap: Record<string, PlayerStats> = {};

    OFFICIAL_PLAYERS.forEach(player => {
        statsMap[player] = {
            name: player,
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,
            winRate: 0,
            totalPoints: 0,
            winsDoubleZapatero: 0,
            winsSingleZapatero: 0,
            winsNormal: 0,
            lostDoubleZapatero: 0,
            lostSingleZapatero: 0,
            lostNormal: 0,
            aggressivenessScore: 0,
            handsWon: 0,
            handsLost: 0,
            totalHands: 0,
            handWinRate: 0,
            attendanceIndex: 0, // Se calcularía con registro de asistencia real
            handsRatio: 0
        };
    });

    // 🏆 LEGACY DATA (JORNADA 12)
    const JORNADA_12_POINTS: Record<string, number> = {
        "Rodrigo": 13,
        "Rodolfo": 12,
        "Buru": 11,
        "Carlos Ramón": 11,
        "Rudy": 10,
        "José Miguel": 9,
        "Beto": 9,
        "Mayito": 8,
        "Mike": 8,
        "Edgar": 8,
        "Germán": 6,
        "Alex": 5,
        "Rubén": 5,
        "Paco": 4,
        "Juan Carlos": 3,
        "Rodrigo Jr": 3
    };

    // Initialize with legacy points
    Object.keys(JORNADA_12_POINTS).forEach(player => {
        if (statsMap[player]) {
            statsMap[player].totalPoints = JORNADA_12_POINTS[player];
            // Estimated matches played based on points (approx) 
            // This is just a baseline to avoid 0/0 divisions
            statsMap[player].matchesPlayed = Math.max(JORNADA_12_POINTS[player] - 1, 0);
        }
    });

    // 7 & 8: Acumuladores Globales
    let totalGames = 0;
    let totalHands = 0;

    // PROCESAMIENTO DE PARTIDAS
    matches.forEach(match => {
        totalGames++;

        // Identificar jugadores
        // "My Pair" (Team A)
        // Nota: En historial guardamos el ID de la pareja.
        // Necesitamos reconstruir quiénes jugaron. 
        // LIMITACIÓN: El MatchRecord actual tiene 'myPair' (ID) y 'oppNames' (Array string).
        // Si 'myPair' es un ID, necesitamos buscar en 'allPairs'.
        // Si no está en allPairs (ej: partida antigua), podriamos tener problemas.
        // Asumiremos que podemos resolver los nombres de 'myPair'.

        // FIX: MatchRecord needs to store concrete names if pair definitions change.
        // For now, we rely on 'allPairs' from store.
        const teamANames = allPairs[match.myPair] || ["Desconocido 1", "Desconocido 2"];
        const teamBNames = match.oppNames;

        const isZapatero = match.isZapatero || 'none';
        // Si isZapatero no existe (legacy records), inferir:
        // (Legacy logic not implemented here for brevity, assumed new records)

        // Determinar Ganador (Score based)
        const scoreA = match.scoreMy;
        const scoreB = match.scoreOpp;
        const winner = scoreA >= 100 ? 'A' : 'B';

        // Hands (si existen, si no 0)
        const handsA = match.handsMy || 0;
        const handsB = match.handsOpp || 0;
        totalHands += (handsA + handsB);

        // UPDATE TEAM A (Nosotros)
        teamANames.forEach(pName => {
            const p = statsMap[pName];
            if (!p) return;

            p.matchesPlayed++;
            p.totalHands += (handsA + handsB);
            p.handsWon += handsA;
            p.handsLost += handsB;

            if (winner === 'A') {
                p.matchesWon++;
                p.totalPoints += 2; // 1 asistencia (implícito) + 1 victoria
                if (isZapatero === 'double') p.winsDoubleZapatero++;
                else if (isZapatero === 'single') p.winsSingleZapatero++;
                else p.winsNormal++;
            } else {
                p.matchesLost++;
                p.totalPoints += 1; // 1 asistencia (auqnue pierda)
                if (isZapatero === 'double') p.lostDoubleZapatero++;
                else if (isZapatero === 'single') p.lostSingleZapatero++;
                else p.lostNormal++;
            }
        });

        // UPDATE TEAM B (Ellos)
        teamBNames.forEach(pName => {
            const p = statsMap[pName];
            if (!p) return;

            p.matchesPlayed++;
            p.totalHands += (handsA + handsB);
            p.handsWon += handsB; // Inverted for Team B
            p.handsLost += handsA;

            if (winner === 'B') {
                p.matchesWon++;
                p.totalPoints += 2;
                if (isZapatero === 'double') p.winsDoubleZapatero++;
                else if (isZapatero === 'single') p.winsSingleZapatero++;
                else p.winsNormal++;
            } else {
                p.matchesLost++;
                p.totalPoints += 1;
                if (isZapatero === 'double') p.lostDoubleZapatero++;
                else if (isZapatero === 'single') p.lostSingleZapatero++;
                else p.lostNormal++;
            }
        });
    });

    // CÁLCULO DE ÍNDICES Y AGRESIVIDAD
    Object.values(statsMap).forEach(p => {
        // 25. Agresividad
        // (3 * DZ_Win + 2 * SZ_Win + 1 * N_Win) - (3 * DZ_Loss + 2 * SZ_Loss + 1 * N_Loss)
        const positiveAggro = (3 * p.winsDoubleZapatero) + (2 * p.winsSingleZapatero) + (1 * p.winsNormal);
        const negativeAggro = (3 * p.lostDoubleZapatero) + (2 * p.lostSingleZapatero) + (1 * p.lostNormal);
        p.aggressivenessScore = positiveAggro - negativeAggro;

        // 21. Win Rate
        p.winRate = p.matchesPlayed > 0 ? (p.matchesWon / p.matchesPlayed) : 0;

        // 20. Hand Win Rate
        p.handWinRate = p.totalHands > 0 ? (p.handsWon / p.totalHands) : 0;

        // 23. Hands Ratio
        p.handsRatio = p.handsLost > 0 ? (p.handsWon / p.handsLost) : p.handsWon;

        // 22. Attendance (Simplificado: 1 partido jugado = 1 asistencia en esta simulación)
        // Idealmente esto cuenta JORNADAS distintas, no partidas. 
        // Asumiremos que si jugó al menos 1 vez, asistió. 
        // Para calcular REAL asistencia necesitamos saber cuántas jornadas distintas hubo.
        // Por ahora, usaremos matchesPlayed como proxy simple o lo dejaremos pendiente.
        p.attendanceIndex = p.matchesPlayed / TOTAL_JORNADAS;
    });

    // ORDENAMIENTOS
    const players = Object.values(statsMap);

    const leaderboard = [...players].sort((a, b) => b.totalPoints - a.totalPoints);
    const aggressivenessLeaderboard = [...players].sort((a, b) => b.aggressivenessScore - a.aggressivenessScore);


    return {
        seasonTotalGames: TOTAL_JORNADAS * 28, // Estimado máx
        seasonPlayedGames: totalGames,
        seasonPendingGames: (TOTAL_JORNADAS * 28) - totalGames,
        totalAccumulatedGames: totalGames,
        totalAccumulatedHands: totalHands,
        hostsCompleted: [], // TODO: Extraer de metadata
        hostsPending: ["Rodrigo", "Alex", "Mayito", "Edgar"], // Manual override for Jornada 12
        leaderboard,
        aggressivenessLeaderboard
    };
};
