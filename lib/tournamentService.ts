/**
 * @file lib/tournamentService.ts
 * @description Backend Service Facade for Supabase Integration.
 * @author Antigravity (Google Deepmind)
 * 
 * ROLE:
 * Bridges the gap between the Client (Browser) and the Database (Supabase).
 * Implements "Live Sync" logic where every major action is mirrored to the cloud.
 */

// ============================================================
// BLOQUE 1: IMPORTS Y CLIENTE SUPABASE
// ============================================================
import { supabase } from "./supabaseClient";
import { MatchRecord } from "./store";

// ============================================================
// BLOQUE 2: TIPOS E INTERFACES (DTOs)
// ============================================================
export interface PairDTO {
    pair_number: number;
    player1: string;
    player2: string;
}

export interface TournamentDTO {
    id: string;
    hostName: string;
    pairs: Record<string, string[]>;
}

// ============================================================
// BLOQUE 3: GESTIÓN DE TORNEO (CRUD Principal)
// ============================================================

// FUNCIÓN: createTournament
// PROPÓSITO: Initializes a new tournament in Supabase and atomic creation of pairs.
// RECIBE: tournamentId: string, hostName: string, pairs: Record<string, string[]>
// RETORNA: Promise<{ success: boolean, pairIds?: Record<string, number>, error?: string }>
// DEPENDE DE: supabase ('tournaments' and 'pairs' tables)
// LLAMADA POR: store.ts -> initializeTournament (when Setup finishes)
export const createTournament = async (tournamentId: string, hostName: string, pairs: Record<string, string[]>) => {
    console.log("☁️ SERVICE: Creating tournament in cloud...", tournamentId);

    try {
        // 1. Create Tournament Record
        const { error: tError } = await supabase
            .from('tournaments')
            .upsert({
                id: tournamentId,
                date: new Date().toISOString().split('T')[0],
                host_name: hostName,
                status: 'active',
                metadata: { created_by: 'v2_app' }
            });

        if (tError) throw new Error(`Tournament Error: ${tError.message}`);

        // 2. Clear Existing Pairs (Atomic Cleanup to prevent duplicates)
        await supabase
            .from('pairs')
            .delete()
            .eq('tournament_id', tournamentId);

        // 3. Create Pairs Records
        const pairsToInsert = Object.entries(pairs).map(([idStr, names]) => ({
            tournament_id: tournamentId,
            pair_number: parseInt(idStr),
            player1_name: names[0],
            player2_name: names[1]
        }));

        const { data: pData, error: pError } = await supabase
            .from('pairs')
            .insert(pairsToInsert)
            .select();

        if (pError) throw new Error(`Pairs Error: ${pError.message}`);

        // Reconstruct pairIds map for the Host to hydrate synchronously
        const pairIds: Record<string, number> = {};
        pData?.forEach((p: any) => {
            pairIds[p.id] = p.pair_number;
        });

        return { success: true, pairIds };

    } catch (e: any) {
        console.error("❌ SERVICE ERROR (createTournament):", e);
        return { success: false, error: e.message };
    }
};

// FUNCIÓN: archiveTournament
// PROPÓSITO: Updates a tournament status to 'finished'.
// RECIBE: payload: any (with tournamentId)
// RETORNA: Promise<{ success: boolean, error?: string }>
// DEPENDE DE: supabase ('tournaments' table)
// LLAMADA POR: store.ts -> (Legacy/Backup) end tournament workflow
export const archiveTournament = async (payload: any) => {
    // Just update status
    const { error } = await supabase
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', payload.tournamentId);

    return { success: !error, error: error?.message };
};

// FUNCIÓN: getCompletedTournamentsCount
// PROPÓSITO: Returns the number of finished tournaments to calculate current Jornada.
// RECIBE: void
// RETORNA: Promise<number> (count of finished tournaments)
// DEPENDE DE: supabase ('tournaments' table)
// LLAMADA POR: store.ts -> during app initialization to set Jornada #
export const getCompletedTournamentsCount = async () => {
    // Count ONLY finished tournaments to calculate next round number
    const { count, error } = await supabase
        .from('tournaments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'finished');

    return count || 0;
};

// ============================================================
// BLOQUE 4: REGISTRO DE PARTIDAS (Match Recording)
// ============================================================

// FUNCIÓN: recordMatch
// PROPÓSITO: Completes and firmly saves a finished match, hands, and clears its live state.
// RECIBE: match: MatchRecord
// RETORNA: Promise<{ success: boolean, error?: string }>
// DEPENDE DE: supabase ('pairs', 'matches', 'match_hands', 'live_matches' tables)
// LLAMADA POR: store.ts -> addMatch
export const recordMatch = async (match: MatchRecord) => {
    console.log("☁️ SERVICE: Recording match...", match.id);

    try {
        // --- 4.1 Buscar UUIDs de parejas ---
        // 1. Fetch Pair IDs
        const { data: pairData, error: pairError } = await supabase
            .from('pairs')
            .select('id, pair_number')
            .eq('tournament_id', match.tournamentId)
            .in('pair_number', [match.myPair, match.oppPair]);

        if (pairError || !pairData) throw new Error("Could not find pair refs");

        const myPairId = pairData.find(p => p.pair_number === match.myPair)?.id;
        const oppPairId = pairData.find(p => p.pair_number === match.oppPair)?.id;

        // 🛡️ V4.2.2 SECURITY: STRICT VALIDATION
        if (!myPairId || !oppPairId) {
            console.error("⛔ CRITICAL: Attempted to save match with UNMAPPED PAIRS.", {
                myPair: match.myPair,
                oppPair: match.oppPair,
                foundPairs: pairData
            });
            throw new Error(`Integrity Error: Could not resolve Pair UUIDs for ${match.myPair} vs ${match.oppPair}. Aborting save.`);
        }

        // Determine Winner ID
        let winnerId = null;

        if (match.scoreMy > match.scoreOpp) {
            winnerId = myPairId;
        } else if (match.scoreOpp > match.scoreMy) {
            winnerId = oppPairId;
        }

        // --- 4.2 Insertar partida ---
        // 2. Insert Match
        const { data: matchInserted, error: mError } = await supabase
            .from('matches')
            .insert({
                tournament_id: match.tournamentId,
                pair_a_id: myPairId,
                pair_b_id: oppPairId,
                pair_a_names: ["?", "?"], // Podría pasarse desde el store si es vital
                pair_b_names: match.oppNames,
                score_a: match.scoreMy,
                score_b: match.scoreOpp,
                hands_a: match.handsMy,
                hands_b: match.handsOpp,
                termination_type: match.isZapatero, // 'double' | 'single' | 'none'
                duration_seconds: 0,
                winner_pair: winnerId,
                timestamp: match.timestamp
            })
            .select('id')
            .single();

        if (mError) throw new Error(mError.message);

        // --- 4.3 Simular manos (temporal hasta que App mande handHistory) ---
        // 2.5 Insert Hands (Fake loop if real data not available, or real if Store updated in future)
        // Por ahora simulamos N registros de manos para que las gráficas no se rompan y cuenten "hands_a" y "hands_b"
        const handsCount = match.handsMy + match.handsOpp;
        const handsInserts = [];
        let curScoreA = 0; let curScoreB = 0;

        for (let i = 1; i <= handsCount; i++) {
            let wTeam = i <= match.handsMy ? 'A' : 'B'; // Simplificación agresiva hasta que la App mande handHistory array
            let pEarnedA = wTeam === 'A' ? Math.floor(match.scoreMy / match.handsMy) : 0;
            let pEarnedB = wTeam === 'B' ? Math.floor(match.scoreOpp / match.handsOpp) : 0;
            curScoreA += pEarnedA; curScoreB += pEarnedB;

            handsInserts.push({
                match_id: matchInserted.id,
                hand_number: i,
                winner_team: wTeam,
                points_earned_a: pEarnedA,
                points_earned_b: pEarnedB,
                score_a: curScoreA,
                score_b: curScoreB
            });
        }

        if (handsInserts.length > 0) {
            await supabase.from('match_hands').insert(handsInserts);
        }

        // --- 4.4 Limpiar live_matches (Anti-Zombie) ---
        // 🧹 V4.9 CLEANUP: DESTROY LIVE MATCH ROW (Anti-Zombie)
        // We must delete the row where these pairs were playing.
        // live_matches key is tournament_id + pair_a + pair_b
        const pA = Math.min(match.myPair, match.oppPair);
        const pB = Math.max(match.myPair, match.oppPair);

        console.log(`🧹 SERVICE: Deleting live_matches row for ${pA} vs ${pB}`);
        await supabase
            .from('live_matches')
            .delete()
            .eq('tournament_id', match.tournamentId)
            .eq('pair_a', pA)
            .eq('pair_b', pB);

        return { success: true };

    } catch (e: any) {
        console.error("❌ SERVICE ERROR (recordMatch):", e);
        // Don't block UI, just log
        return { success: false, error: e.message };
    }
};

// ============================================================
// BLOQUE 5: MARCADORES EN VIVO (Live Match CRUD)
// ============================================================

// FUNCIÓN: updateLiveMatch
// PROPÓSITO: Updates the ephemeral score state in live_matches.
// RECIBE: tournamentId: string, myPair: number, oppPair: number, scoreMy: number, scoreOpp: number, handNum: number, scorekeeper?: string
// RETORNA: Promise<void> (silent fail)
// DEPENDE DE: supabase ('live_matches' table)
// LLAMADA POR: UI (ScoreBoard / Keyboard) when a hand finishes
export const updateLiveMatch = async (tournamentId: string, myPair: number, oppPair: number, scoreMy: number, scoreOpp: number, handNum: number, scorekeeper?: string) => {
    // 1. Normalize Keys (Pair A always smaller)
    const isASmaller = myPair < oppPair;
    const pairA = isASmaller ? myPair : oppPair;
    const pairB = isASmaller ? oppPair : myPair;
    const scoreA = isASmaller ? scoreMy : scoreOpp;
    const scoreB = isASmaller ? scoreOpp : scoreMy;

    try {
        const payload: any = {
            tournament_id: tournamentId,
            pair_a: pairA,
            pair_b: pairB,
            score_a: scoreA,
            score_b: scoreB,
            hand_number: handNum,
            last_updated: new Date().toISOString()
        };

        // V8.3 Soft-Lock: Solo inyectamos scorekeeper si nos lo pasan.
        if (scorekeeper) {
            payload.scorekeeper = scorekeeper;
        }

        const { error } = await supabase
            .from('live_matches')
            .upsert(payload);

        if (error) throw error;
    } catch (e) {
        // Silent fail for live updates, don't block gameplay
        console.warn("⚠️ Live Update Failed:", e);
    }
};

// FUNCIÓN: deleteLiveMatch
// PROPÓSITO: Removes the live record explicitly (cleanup).
// RECIBE: tournamentId: string, myPair: number, oppPair: number
// RETORNA: Promise<void>
// DEPENDE DE: supabase ('live_matches' table)
// LLAMADA POR: store.ts -> removeLiveScore / UI cleanup
export const deleteLiveMatch = async (tournamentId: string, myPair: number, oppPair: number) => {
    const pairA = Math.min(myPair, oppPair);
    const pairB = Math.max(myPair, oppPair);

    try {
        await supabase
            .from('live_matches')
            .delete()
            .match({ tournament_id: tournamentId, pair_a: pairA, pair_b: pairB });
    } catch (e) {
        console.warn("⚠️ Live Delete Failed:", e);
    }
};

// ============================================================
// BLOQUE 6: SINCRONIZACIÓN MULTIPLAYER (App State Global)
// ============================================================

// FUNCIÓN: updateHostName
// PROPÓSITO: Updates the host name for today's tournament or creates a placeholder.
// RECIBE: hostName: string
// RETORNA: Promise<{ success: boolean, tournamentId?: string, error?: string }>
// DEPENDE DE: supabase ('tournaments' table)
// LLAMADA POR: UI (Lobby / Login) at step 1
export const updateHostName = async (hostName: string) => {
    console.log("🌍 SYNC: Updating host name:", hostName);
    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Check if a tournament exists for today
        const { data: existing, error: fetchError } = await supabase
            .from('tournaments')
            .select('id')
            .eq('date', today)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (existing) {
            // Update existing tournament
            const { error: updateError } = await supabase
                .from('tournaments')
                .update({ host_name: hostName })
                .eq('id', existing.id);

            if (updateError) throw updateError;
            return { success: true, tournamentId: existing.id };
        } else {
            // Create placeholder tournament (will be fully configured later)
            // Use a temporary ID that will be replaced when setup is completed
            const tempId = `temp_${Date.now()}`;
            const { data: newTournament, error: createError } = await supabase
                .from('tournaments')
                .insert({
                    id: tempId,
                    date: today,
                    host_name: hostName,
                    status: 'planned',
                    metadata: { placeholder: true }
                })
                .select('id')
                .single();

            if (createError) throw createError;
            return { success: true, tournamentId: newTournament.id };
        }
    } catch (e: any) {
        console.error("❌ SYNC ERROR (updateHostName):", e);
        return { success: false, error: e.message };
    }
};

// FUNCIÓN: setActiveTournament
// PROPÓSITO: Publishes the given tournament ID as the GLOBALLY ACTIVE tournament.
// RECIBE: tournamentId: string
// RETORNA: Promise<{ success: boolean, error?: string }>
// DEPENDE DE: supabase ('app_state' table global_config key)
// LLAMADA POR: store.ts -> initializeTournament (Host role)
export const setActiveTournament = async (tournamentId: string) => {
    console.log("🌍 SYNC: Setting active tournament:", tournamentId);
    try {
        const { error } = await supabase
            .from('app_state')
            .upsert({
                key: 'global_config',
                value: { active_tournament_id: tournamentId },
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("❌ SYNC ERROR (setActive):", e);
        return { success: false, error: e.message };
    }
};

// FUNCIÓN: deactivateTournament
// PROPÓSITO: Clears the active tournament from global configuration (kills the session).
// RECIBE: void
// RETORNA: Promise<{ success: boolean, error?: string }>
// DEPENDE DE: supabase ('app_state' and 'tournaments' tables)
// LLAMADA POR: store.ts -> clearTournament / Reset roles
export const deactivateTournament = async () => {
    console.log("🌍 SYNC: Deactivating GLOBAL tournament...");
    try {
        // 1. Get current active tournament ID
        const { data: appState } = await supabase
            .from('app_state')
            .select('value')
            .eq('key', 'global_config')
            .single();

        const activeTournamentId = appState?.value?.active_tournament_id;

        // 2. Clear host_name from tournaments table if there's an active tournament
        if (activeTournamentId) {
            console.log("🧹 Clearing host_name from tournament:", activeTournamentId);
            await supabase
                .from('tournaments')
                .update({ host_name: null })
                .eq('id', activeTournamentId);
        }

        // 3. Also clear host_name from today's tournament (in case it's a different one)
        const today = new Date().toISOString().split('T')[0];
        await supabase
            .from('tournaments')
            .update({ host_name: null })
            .eq('date', today);

        // 4. Deactivate tournament in app_state
        const { error } = await supabase
            .from('app_state')
            .upsert({
                key: 'global_config',
                value: { active_tournament_id: null }, // NULL kills the session
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log("✅ Tournament and host_name cleared");
        return { success: true };
    } catch (e: any) {
        console.error("❌ SYNC ERROR (deactivate):", e);
        return { success: false, error: e.message };
    }
};

// FUNCIÓN: getActiveTournamentId
// PROPÓSITO: One-shot check for the current active ID.
// RECIBE: void
// RETORNA: Promise<{ success: boolean, activeId: string | null, error?: string }>
// DEPENDE DE: supabase ('app_state' table global_config key)
// LLAMADA POR: GlobalSync.tsx -> initial hydration
export const getActiveTournamentId = async () => {
    try {
        const { data, error } = await supabase
            .from('app_state')
            .select('value')
            .eq('key', 'global_config')
            .single();

        if (error) return { success: false, error: error.message };

        return { success: true, activeId: data?.value?.active_tournament_id || null };
    } catch (e: any) {
        return { success: false, error: e.message }; // Fail safe
    }
};


// ============================================================
// BLOQUE 7: HIDRATACIÓN DE CLIENTES (Fetch / Read)
// ============================================================

// FUNCIÓN: fetchTournamentConfig
// PROPÓSITO: Recovers full config (Host + Pairs) from Supabase to hydrate clients.
// RECIBE: tournamentId: string
// RETORNA: Promise<{ success: boolean, config?: Object, error?: string }>
// DEPENDE DE: supabase ('tournaments', 'pairs' tables)
// LLAMADA POR: Object/GlobalSync -> remote hydration of clients
export const fetchTournamentConfig = async (tournamentId: string) => {
    try {
        // 1. Fetch Tournament Info (Host)
        const { data: tData, error: tError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tError || !tData) throw new Error("Tournament not found");

        // 2. Fetch Pairs
        const { data: pData, error: pError } = await supabase
            .from('pairs')
            .select('*')
            .eq('tournament_id', tournamentId);

        if (pError) throw new Error("Pairs not found");

        // 3. Reconstruct Pairs Object: Record<string, string[]>
        const pairsMap: Record<string, string[]> = {};
        const pairIds: Record<string, number> = {};

        pData.forEach((p: any) => {
            pairsMap[p.pair_number.toString()] = [p.player1_name, p.player2_name];
            pairIds[p.id] = p.pair_number; // Map UUID -> pair_number
        });

        return {
            success: true,
            config: {
                id: tData.id,
                hostName: tData.host_name,
                pairs: pairsMap,
                pairIds: pairIds // Needed for Realtime Subscription
            }
        };

    } catch (e: any) {
        console.error("❌ SYNC ERROR (fetchConfig):", e);
        return { success: false, error: e.message };
    }
};

// FUNCIÓN: fetchMatches
// PROPÓSITO: Retrieves all completed matches for a given tournament using SQL Relations.
// RECIBE: tournamentId: string
// RETORNA: Promise<{ success: boolean, matches?: MatchRecord[], error?: string }>
// DEPENDE DE: supabase ('matches', 'pairs' relational join)
// LLAMADA POR: store.ts -> syncMatches / GlobalSync.tsx polling
export const fetchMatches = async (tournamentId: string) => {
    try {
        // Query with JOIN to get pair_numbers
        const { data, error } = await supabase
            .from('matches')
            .select(`
                *,
                pair_a:pair_a_id ( pair_number ),
                pair_b:pair_b_id ( pair_number )
            `)
            .eq('tournament_id', tournamentId)
            .order('timestamp', { ascending: true });

        if (error) throw error;

        // Map DB -> Store MatchRecord
        const matches: MatchRecord[] = (data || []).map((m: any) => ({
            id: m.id,
            tournamentId: m.tournament_id,

            // Map joined fields safely
            myPair: m.pair_a?.pair_number || 0,
            oppPair: m.pair_b?.pair_number || 0,

            scoreMy: m.score_a,
            scoreOpp: m.score_b,
            oppNames: m.pair_b_names || ["?", "?"], // We keep original names stored

            // Stats
            handsMy: m.hands_a,
            handsOpp: m.hands_b,
            isZapatero: m.termination_type,
            timestamp: m.timestamp
        }));

        return { success: true, matches };

    } catch (e: any) {
        console.error("❌ SYNC ERROR (fetchMatches):", e);
        return { success: false, error: e.message };
    }
};

// FUNCIÓN: checkActiveMatchForPair
// PROPÓSITO: Revisa si una pareja tiene actualmente un partido "vivo" para (Reconexión Mágica).
// RECIBE: tournamentId: string, pairNum: number
// RETORNA: Promise<{ success: boolean, hasActiveMatch: boolean, matchData?: any, error?: string }>
// DEPENDE DE: supabase ('live_matches' table)
// LLAMADA POR: UI (Game start logic) to prevent duplication or trigger magic reconnect
export const checkActiveMatchForPair = async (tournamentId: string, pairNum: number) => {
    try {
        const { data, error } = await supabase
            .from('live_matches')
            .select('*')
            .eq('tournament_id', tournamentId)
            .or(`pair_a.eq.${pairNum},pair_b.eq.${pairNum}`)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Rows not found" (expected if no active match)
            throw error;
        }

        if (data) {
            return {
                success: true,
                hasActiveMatch: true,
                matchData: data
            };
        }

        return { success: true, hasActiveMatch: false };
    } catch (e: any) {
        console.error("❌ SYNC ERROR (checkActiveMatchForPair):", e);
        return { success: false, error: e.message };
    }
};
