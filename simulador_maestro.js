/**
 * 🤖 SIMULADOR MAESTRO (Backend Sandbox) - V9 TITANIUM
 * 
 * Uso:
 * node simulador_maestro.js --jugadores=16 --retraso=100 --caos=false
 */

require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// ==========================================================
// CONFIGURACIÓN DEL ENTORNO LOCAL
// ==========================================================
console.log(`\n==========================================`);
console.log(`🧪 HANGAR SUBTERRÁNEO DE PRUEBAS (V9 TITANIUM)`);
console.log(`==========================================`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Faltan credenciales locales en .env.test");
    process.exit(1);
}

// Cliente que conecta exclusivamente con el contenedor de Docker Local
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================================
// PARSEO DE BANDERAS (CLI ARGS)
// ==========================================================
const args = process.argv.slice(2);
const getConfig = (argName, defValue) => {
    const arg = args.find(a => a.startsWith(`--${argName}=`));
    return arg ? arg.split('=')[1] : defValue;
};

// Flags de Ejecución
const numJugadores = parseInt(getConfig('jugadores', '16'), 10);
const delayMs = parseInt(getConfig('retraso', '50'), 10);
const caosMode = getConfig('caos', 'false') === 'true';

if (numJugadores % 2 !== 0 || numJugadores < 4) {
    console.error("❌ El número de jugadores debe ser par (Mínimo 4).");
    process.exit(1);
}

console.log(`[ℹ️] Variables de Ejecución:`);
console.log(`   - Jugadores Simulados : ${numJugadores}`);
console.log(`   - Retraso de Red (ms) : ${delayMs}`);
console.log(`   - Inyección de Caos   : ${caosMode ? 'ON (Stale-Reads, Múltiples dueños, etc)' : 'OFF (Secuencial Perfecto)'}`);
console.log(`------------------------------------------\n`);

// Herramientas
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const logInfo = (msg) => console.log('\x1b[36m%s\x1b[0m', `[INFO] ${msg}`);
const logSuccess = (msg) => console.log('\x1b[32m%s\x1b[0m', `[OK]   ${msg}`);
const logWarn = (msg) => console.log('\x1b[33m%s\x1b[0m', `[WARN] ${msg}`);
const logError = (msg) => console.log('\x1b[31m%s\x1b[0m', `[ERR]  ${msg}`);

const NOMBRES = [
    "Alex", "Beto", "Buru", "Carlos R",
    "Edgar", "Germán", "J Miguel", "Juan C",
    "Mayito", "Mike", "Paco", "Rodolfo",
    "Rodrigo", "Rodrigo Jr", "Rubén", "Rudy"
];

// ==========================================================
// MEMORIA DEL LABORATORIO
// ==========================================================
let globalTournamentId = "00000000-0000-0000-0000-000000000000";
let pairsMap = {}; // {pairNum: [name1, name2]}

// ==========================================================
// CLASES BOTS
// ==========================================================

class BotAnfitrion {
    async purgarLaboratorio() {
        logInfo("Purgando base de datos local (Hard Reset Múltiple)...");
        await supabase.from('matches').delete().neq('id', 'invalid');
        await supabase.from('live_matches').delete().neq('tournament_id', 'invalid');
        await supabase.from('pairs').delete().neq('id', 'invalid');
        await supabase.from('tournaments').delete().neq('id', 'invalid');
        logSuccess("Laboratorio purgado y estéril para prueba.");
    }

    async crearTorneoYParejas(nJugadores) {
        logInfo(`Fase 1: Creando torneo de ${nJugadores} jugadores (${nJugadores / 2} parejas)...`);

        // 1. Crear Torneo
        const { data: tData, error: tErr } = await supabase
            .from('tournaments')
            .insert({
                date: new Date().toISOString().split('T')[0],
                host_name: 'Sim_Host',
                status: 'active'
            }).select().single();

        if (tErr) throw new Error("Falla al crear torneo: " + tErr.message);
        globalTournamentId = tData.id;
        logSuccess(`Torneo Creado: ${globalTournamentId.split('-')[0]}`);

        // 2. Crear Parejas Sequenciales
        const numParejas = nJugadores / 2;
        let indexNombres = 0;

        for (let i = 1; i <= numParejas; i++) {
            let p1 = NOMBRES[indexNombres % NOMBRES.length] + "_" + i;
            let p2 = NOMBRES[(indexNombres + 1) % NOMBRES.length] + "_" + i;
            indexNombres += 2;

            pairsMap[i] = [p1, p2];

            const { error: pErr } = await supabase.from('pairs').insert({
                tournament_id: globalTournamentId,
                pair_number: i,
                player1_name: p1,
                player2_name: p2
            });
            if (pErr) throw new Error(`Falla al crear pareja ${i}: ` + pErr.message);
        }
        logSuccess(`Insertadas las ${numParejas} parejas en BD.\n`);
    }
}

class BotMesa {
    constructor(numeroMesa, pA, pB) {
        this.mesaId = `Partido-${numeroMesa}`;
        this.pairA = Math.min(pA, pB);
        this.pairB = Math.max(pA, pB);
        this.nombreScorekeeper = pairsMap[this.pairA][0];
    }

    async jugar() {
        logInfo(`[${this.mesaId}] Cargando: Pareja ${this.pairA} vs Pareja ${this.pairB}. Dueño: ${this.nombreScorekeeper}`);

        // INICIO - Creación en live_matches
        const { error: liveErr } = await supabase.from('live_matches').upsert({
            tournament_id: globalTournamentId,
            pair_a: this.pairA,
            pair_b: this.pairB,
            score_a: 0,
            score_b: 0,
            hand_number: 0,
            scorekeeper: this.nombreScorekeeper,
            last_updated: new Date().toISOString()
        }, { onConflict: 'tournament_id, pair_a, pair_b' });

        if (liveErr) {
            logError(`[${this.mesaId}] Error iniciando live_match: ${liveErr.message}`);
            return;
        }

        // DESARROLLO DE MANOS
        let sA = 0; let sB = 0; let hand = 1;
        while (sA < 100 && sB < 100) {
            await delay(delayMs); // Delay artificial de latencia
            const pts = Math.floor(Math.random() * 25) + 10;
            if (Math.random() > 0.5) sA += pts; else sB += pts;

            // Si modo CAOS está activado, simulamos cruces asíncronos y latencias de lectura
            if (caosMode && Math.random() > 0.8) {
                // Simulamos un click simultáneo de un Espectador intentando robar el control al mismo tiempo
                await Promise.all([
                    supabase.from('live_matches').update({ score_a: sA, score_b: sB, hand_number: hand, last_updated: new Date().toISOString() })
                        .eq('tournament_id', globalTournamentId).eq('pair_a', this.pairA).eq('pair_b', this.pairB),
                    supabase.from('live_matches').update({ scorekeeper: "Intruso_Caos" }).eq('tournament_id', globalTournamentId).eq('pair_a', this.pairA).eq('pair_b', this.pairB)
                ]);
            } else {
                await supabase.from('live_matches').update({
                    score_a: sA, score_b: sB, hand_number: hand, last_updated: new Date().toISOString()
                }).eq('tournament_id', globalTournamentId).eq('pair_a', this.pairA).eq('pair_b', this.pairB);
            }
            hand++;
        }

        // FIN DE PARTIDA - Insertar Resultado
        const { error: mErr } = await supabase.from('matches').insert({
            tournament_id: globalTournamentId,
            pair_a_names: pairsMap[this.pairA],
            pair_b_names: pairsMap[this.pairB],
            score_a: sA,
            score_b: sB
        });

        if (mErr) logError(`[${this.mesaId}] Error final: ${mErr.message}`);

        await supabase.from('live_matches').delete()
            .eq('tournament_id', globalTournamentId).eq('pair_a', this.pairA).eq('pair_b', this.pairB);

        logSuccess(`[${this.mesaId}] Partida Finalizada (${sA} - ${sB}). Liberada.`);
    }
}

class BotAuditor {
    async verificar(totalEsperadas) {
        logInfo(`--- FASE 3: AUDITORÍA FINAL ---`);
        const { count } = await supabase.from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', globalTournamentId);

        if (count === totalEsperadas) {
            logSuccess(`🏆 AUDITORÍA EXITOSA: ${count}/${totalEsperadas} registros exactos confirmados.`);
            return true;
        } else {
            logError(`💥 AUDITORÍA FALLIDA: Se esperaban ${totalEsperadas}, pero existen ${count} en la DB.`);
            return false;
        }
    }
}

// ==========================================================
// ORQUESTADOR MAESTRO
// ==========================================================
async function lanzarSimulacion() {
    try {
        const anfitrion = new BotAnfitrion();
        const auditor = new BotAuditor();

        await anfitrion.purgarLaboratorio();
        await anfitrion.crearTorneoYParejas(numJugadores);

        const numParejas = numJugadores / 2;

        logInfo(`--- FASE 2: SIMULANDO JORNADA (ROUND ROBIN OFICIAL) ---`);
        logInfo(`> Total Jugadores: ${numJugadores}`);
        logInfo(`> Total Parejas: ${numParejas}`);

        // Algoritmo de Berger (Round-Robin Cíclico)
        // Para calcular rotaciones y descansos (Retadoras) correctamente.
        let parejasArr = Array.from({ length: numParejas }, (_, i) => i + 1);
        let tieneRetadora = numParejas % 2 !== 0;

        // Si es impar, añadimos un "Fantasma" (Bypass)
        if (tieneRetadora) {
            parejasArr.push(null);
        }

        const cantEquipos = parejasArr.length;
        const rondas = cantEquipos - 1;
        const partidosPorRonda = cantEquipos / 2;

        let agenda = [];
        let totalMatchesEsperados = 0;

        for (let r = 0; r < rondas; r++) {
            let rondaActual = [];
            let restingPair = null;

            for (let i = 0; i < partidosPorRonda; i++) {
                let pA = parejasArr[i];
                let pB = parejasArr[cantEquipos - 1 - i];

                if (pA !== null && pB !== null) {
                    rondaActual.push([pA, pB]);
                    totalMatchesEsperados++;
                } else {
                    restingPair = pA === null ? pB : pA;
                }
            }
            agenda.push({ numero: r + 1, choques: rondaActual, retadora: restingPair });

            // Rotar array circular (El índice 0 se queda fijo como pivote, el resto rota)
            parejasArr.splice(1, 0, parejasArr.pop());
        }

        logInfo(`> Mesas Físicas Útiles: ${Math.floor(numParejas / 2)}`);
        logInfo(`> Rotación de Retadoras Activada: ${tieneRetadora ? 'SÍ' : 'NO (Número Par)'}`);
        logInfo(`> Partidas Totales Calculadas: ${totalMatchesEsperados}\n`);

        let mesaGlobalId = 1;

        // Ejecución Secuencial Estricta por RONDA (Para respetar la Banca)
        for (const ronda of agenda) {
            logInfo(`\n>>> INICIANDO RONDA ${ronda.numero} DE ${rondas} <<<`);
            if (ronda.retadora) {
                logWarn(`(En Banca / Retadora: Pareja ${ronda.retadora} - ${pairsMap[ronda.retadora].join(' y ')})`);
            }

            let promesasDelCaos = [];
            ronda.choques.forEach(c => {
                const mesa = new BotMesa(mesaGlobalId++, c[0], c[1]);
                promesasDelCaos.push(mesa.jugar());
            });

            // Esperamos que TODAS las mesas de esta ronda terminen antes de llamar al Retador
            await Promise.all(promesasDelCaos);
        }

        const pass = await auditor.verificar(totalMatchesEsperados);
        if (!pass && caosMode) {
            logWarn(`El Modo CAOS ha expuesto una brecha de concurrencia.`);
        }

    } catch (err) {
        console.error("❌ Excepción Catastrófica en Motor Principal:", err);
    }
}

lanzarSimulacion();
