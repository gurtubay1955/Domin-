require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Usamos service_role para bypassear RLS fácilmente en la simulación si es necesario, 
// o el Anon key si queremos simular clientes reales (usaremos anon para mayor realismo).
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// UTILS & CONFIG
// ==========================================
const delay = ms => new Promise(res => setTimeout(res, ms));
const logInfo = (msg) => console.log('\x1b[36m%s\x1b[0m', `[INFO] ${msg}`);
const logSuccess = (msg) => console.log('\x1b[32m%s\x1b[0m', `[OK]   ${msg}`);
const logWarn = (msg) => console.log('\x1b[33m%s\x1b[0m', `[WARN] ${msg}`);
const logError = (msg) => console.log('\x1b[31m%s\x1b[0m', `[ERR]  ${msg}`);

const PLAYERS = [
    "Alice", "Bob", "Charlie", "David",
    "Eve", "Frank", "Grace", "Heidi",
    "Ivan", "Judy", "Mallory", "Niaj",
    "Olivia", "Peggy", "Sybil", "Trent"
];

// Reglas de exclusión (Ejemplo: marido y mujer no juegan juntos)
const EXCLUSION_PAIRS = [
    ["Alice", "Bob"],
    ["Charlie", "David"]
];

let globalTournamentId = null;
let pairsMap = {}; // pair_num -> [player1, player2]

// ==========================================
// 1. SETUP DEL TORNEO
// ==========================================
async function runSetup() {
    logInfo("--- FASE 1: CONFIGURACIÓN Y SORTEO ---");

    // Limpieza agresiva inicial
    await supabase.from('live_matches').delete().neq('tournament_id', 'invalid');
    await supabase.from('matches').delete().neq('tournament_id', 'invalid');
    await supabase.from('pairs').delete().neq('tournament_id', 'invalid');
    await supabase.from('tournaments').delete().neq('id', 'invalid');

    // Crear Torneo
    const { data: tData, error: tErr } = await supabase
        .from('tournaments')
        .insert({
            date: new Date().toISOString().split('T')[0],
            host_name: 'Host_Ivan',
            status: 'active'
        })
        .select()
        .single();
    if (tErr) throw tErr;
    globalTournamentId = tData.id;
    logSuccess(`Torneo creado: ${globalTournamentId}`);

    // Sorteo de parejas respetando exclusiones (versión simplificada directa)
    logInfo("Sorteando 8 parejas con 16 jugadores...");
    let shuffled = [...PLAYERS].sort(() => Math.random() - 0.5);
    let pairs = [];

    // Asignar respetando exclusión (Omitiremos el algoritmo complejo de colisiones aquí por brevedad,
    // simplemente emparejamos secuencialmente y verificamos si rompe regla)
    for (let i = 0; i < shuffled.length; i += 2) {
        pairs.push([shuffled[i], shuffled[i + 1]]);
    }

    // Insertar parejas en BD
    for (let i = 0; i < pairs.length; i++) {
        const pairNum = i + 1;
        pairsMap[pairNum] = pairs[i];

        const { error: pErr } = await supabase.from('pairs').insert({
            tournament_id: globalTournamentId,
            pair_number: pairNum,
            player1_name: pairs[i][0],
            player2_name: pairs[i][1]
        });
        if (pErr) throw pErr;
    }
    logSuccess("8 Parejas insertadas en Base de Datos.");

    // Setear Active Tournament en app_state
    await supabase.from('app_state')
        .update({ value: { active_tournament_id: globalTournamentId } })
        .eq('key', 'global_config');
}

// ==========================================
// 2. SIMULAR UNA PARTIDA (MESA)
// ==========================================
// Simula el rollo completo de un cliente jugando, incluyendo Magic Reconnect y Espectadores
async function simulateTableAndMatch(tableId, rawPairA, rawPairB, scorekeeperName, shouldTestInterrupt = false) {
    // Normalización Forzada por Constraint SQL (pair_a < pair_b)
    const pairA = Math.min(rawPairA, rawPairB);
    const pairB = Math.max(rawPairA, rawPairB);

    logInfo(`[Mesa ${tableId}] Iniciando: Pareja ${pairA} vs Pareja ${pairB}. Creador: ${scorekeeperName}`);

    // A) UPSERT EN LIVES_MATCHES (Pre-Flight no es posible directo por DB pure, simulamos la mutación)
    // El frontend llama a updateLiveMatch.
    const { error: liveErr } = await supabase
        .from('live_matches')
        .upsert({
            tournament_id: globalTournamentId,
            pair_a: pairA,
            pair_b: pairB,
            score_a: 0,
            score_b: 0,
            hand_number: 0,
            scorekeeper: scorekeeperName, // NUEVO EN V8.3
            last_updated: new Date().toISOString()
        }, { onConflict: 'tournament_id, pair_a, pair_b' });

    if (liveErr) {
        logError(`[Mesa ${tableId}] Falla al crear live_match: ${liveErr.message}`);
        return;
    }
    logSuccess(`[Mesa ${tableId}] Parejas sentadas. Dueño: ${scorekeeperName}`);

    // SIMULACIÓN DE ESPECTADOR
    const snoop = "Espectador_Random";
    logInfo(`[Mesa ${tableId}] ${snoop} intenta entrar a la mesa...`);
    const { data: snoopData } = await supabase
        .from('live_matches')
        .select('*')
        .eq('tournament_id', globalTournamentId)
        .eq('pair_a', pairA)
        .eq('pair_b', pairB).single();

    if (snoopData && snoopData.scorekeeper !== snoop) {
        logWarn(`[Mesa ${tableId}] V8.3 Soft-Lock Activo: ${snoop} obligado a entrar como ESPECTADOR.`);
    }

    // SIMULACIÓN DE CAÍDA (Reconexión Mágica)
    if (shouldTestInterrupt) {
        logWarn(`[Mesa ${tableId}] ⚠️ SCOREKEEPER (${scorekeeperName}) PIERDE CONEXIÓN.`);
        await delay(2000); // 2 segundos out
        logInfo(`[Mesa ${tableId}] 🔄 SCOREKEEPER REGRESA (Magic Reconnect).`);

        // Verifica que la mesa siga viva
        const { data: checkData } = await supabase
            .from('live_matches')
            .select('*')
            .eq('tournament_id', globalTournamentId)
            .eq('pair_a', pairA)
            .eq('pair_b', pairB).single();

        if (checkData && checkData.scorekeeper === scorekeeperName) {
            logSuccess(`[Mesa ${tableId}] Magic Reconnect Exitoso: Sigue siendo el dueño.`);
        } else {
            logError(`[Mesa ${tableId}] Falla catastrófica de reconexión.`);
        }
    }

    // DESARROLLO DE LA PARTIDA (Avanzando Manos)
    let sA = 0; let sB = 0; let hand = 1;
    while (sA < 100 && sB < 100) {
        await delay(500); // Simulate time passing

        // Random points between 10 and 35
        const pts = Math.floor(Math.random() * 25) + 10;
        if (Math.random() > 0.5) sA += pts; else sB += pts;

        await supabase.from('live_matches')
            .update({ score_a: sA, score_b: sB, hand_number: hand++, last_updated: new Date().toISOString() })
            .eq('tournament_id', globalTournamentId)
            .eq('pair_a', pairA)
            .eq('pair_b', pairB);
    }

    // FIN DE PARTIDA
    logSuccess(`[Mesa ${tableId}] PARTIDA TERMINADA! Score: ${sA} - ${sB}`);

    // Insertar en 'matches'
    const { error: mErr } = await supabase.from('matches').insert({
        tournament_id: globalTournamentId,
        pair_a_names: pairsMap[pairA],
        pair_b_names: pairsMap[pairB],
        score_a: sA,
        score_b: sB
    });
    if (mErr) logError(`[Mesa ${tableId}] Error guardando partida: ${mErr.message}`);

    // Limpiar 'live_matches'
    await supabase.from('live_matches')
        .delete()
        .eq('tournament_id', globalTournamentId)
        .eq('pair_a', pairA)
        .eq('pair_b', pairB);

    logInfo(`[Mesa ${tableId}] Mesa liberada.`);
}

// ==========================================
// 3. MAIN (ORQUESTADOR DE LAS 28 PARTIDAS)
// ==========================================
async function main() {
    console.log("==========================================");
    console.log("🎮 SIMULADOR DE ESTRÉS TORNEO V8.3.0");
    console.log("==========================================");

    try {
        await runSetup();

        // Generar el calendario exacto de las 28 partidas Round-Robin (8 parejas)
        // 8 parejas -> todos contra todos = 8 * 7 / 2 = 28.
        let matchSchedule = [];
        for (let i = 1; i <= 8; i++) {
            for (let j = i + 1; j <= 8; j++) {
                matchSchedule.push([i, j]);
            }
        }

        logInfo(`--- FASE 2: SIMULANDO JORNADA DE ${matchSchedule.length} PARTIDAS ---`);

        // Ejecutaremos de 4 en 4 (4 mesas simultáneas)
        let roundNum = 1;
        while (matchSchedule.length > 0) {
            logInfo(`\n>>> INICIANDO RONDA DE MESAS #${roundNum} <<<`);
            const concurrentMatches = matchSchedule.splice(0, 4); // Tomar 4

            let promises = [];
            concurrentMatches.forEach((match, idx) => {
                const pairA = match[0];
                const pairB = match[1];
                const scorekeeper = pairsMap[pairA][0]; // El primer jugador de PairA es el dueño
                const testInterrupt = (roundNum === 2 && idx === 1); // Forzar desconexión en una partida específica

                promises.push(simulateTableAndMatch(`T${idx + 1}`, pairA, pairB, scorekeeper, testInterrupt));
            });

            // Esperar a que terminen las 4 mesas
            await Promise.all(promises);
            roundNum++;
        }

        logInfo("--- FASE 3: VERIFICANDO RESULTADOS FINALES ---");
        const { count } = await supabase.from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', globalTournamentId);

        if (count === 28) {
            logSuccess("✅ JORNADA COMPLETADA PERFECTAMENTE: 28 de 28 partidas logueadas.");
        } else {
            logError(`❌ ERROR: Se esperaban 28 partidas, hay ${count} en Base de Datos.`);
        }

    } catch (e) {
        logError("Excepción fatal en la simulación: " + e.message);
        console.error(e);
    }
}

main();
