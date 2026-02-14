/**
 * @file lib/tournamentService.ts
 * @description Backend Service Facade for Supabase Integration.
 * @author Antigravity (Google Deepmind)
 * 
 * ROLE:
 * Bridges the gap between the Client (Browser) and the Database (Supabase).
 * Implements "Live Sync" logic where every major action is mirrored to the cloud.
 */

import { supabase } from "./supabaseClient";
import { MatchRecord } from "./store";

// --- Types ---
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

/**
 * createTournament
 * Initializes a new tournament in Supabase.
 * Should be called when the user finishes the 'Setup' phase.
 */
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

        // 2. Create Pairs Records
        const pairsToInsert = Object.entries(pairs).map(([idStr, names]) => ({
            tournament_id: tournamentId,
            pair_number: parseInt(idStr),
            player1_name: names[0],
            player2_name: names[1]
        }));

        const { error: pError } = await supabase
            .from('pairs')
            .insert(pairsToInsert);

        if (pError) throw new Error(`Pairs Error: ${pError.message}`);

        return { success: true };

    } catch (e: any) {
        console.error("❌ SERVICE ERROR (createTournament):", e);
        return { success: false, error: e.message };
    }
};

/**
 * recordMatch
 * Saves a completed match to Supabase.
 * Should be called immediately after 'addMatch' in the store.
 */
export const recordMatch = async (match: MatchRecord) => {
    console.log("☁️ SERVICE: Recording match...", match.id);

    try {
        // Need to find pair UUIDs first? 
        // For V1, we might rely on pair_number if we don't have UUIDs in store yet.
        // Actually, our schema references pairs(id). 
        // OPTIMIZATION: For this phase, we will fetch pair IDs by tournament_id + pair_number.

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

        // Determine Winner ID (Optional)
        const winnerId = match.scoreMy > match.scoreOpp ? myPairId : oppPairId;

        // 2. Insert Match
        const { error: mError } = await supabase
            .from('matches')
            .insert({
                id: match.id, // Use same UUID from frontend
                tournament_id: match.tournamentId,
                pair_a_id: myPairId,
                pair_b_id: oppPairId,
                // pair_a_names: JSON.stringify(match.oppNames), // REMOVED DUPLICATE
                // We'll trust the backend/frontend synchronization later. 
                // For now, let's send what we have.
                pair_a_names: ["?", "?"], // specific names hard to get here without store access
                pair_b_names: match.oppNames,

                score_a: match.scoreMy,
                score_b: match.scoreOpp,

                hands_a: match.handsMy,
                hands_b: match.handsOpp,

                termination_type: match.isZapatero, // 'double' | 'single' | 'none'
                duration_seconds: 0, // TODO: Add duration tracking
                winner_pair: winnerId,
                timestamp: match.timestamp
            });

        if (mError) throw new Error(mError.message);

        return { success: true };

    } catch (e: any) {
        console.error("❌ SERVICE ERROR (recordMatch):", e);
        // Don't block UI, just log
        return { success: false, error: e.message };
    }
};

/**
 * archiveTournament (Legacy/Backup)
 * Updates status to finished.
 */
export const archiveTournament = async (payload: any) => {
    // Just update status
    const { error } = await supabase
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', payload.tournamentId);

    return { success: !error, error: error?.message };
};

/**
 * getCompletedTournamentsCount
 * Returns the number of tournaments with status 'finished' + 'active' (history).
 * Used to calculate the current "Jornada #".
 */
export const getCompletedTournamentsCount = async () => {
    // Count ONLY finished tournaments to calculate next round number
    const { count, error } = await supabase
        .from('tournaments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'finished');

    return count || 0;
};

// --- REAL-TIME LIVE PROGRESS (V3.1) ---

/**
 * updateLiveMatch
 * Updates the ephemeral score state in Supabase.
 * Call this every time a hand is finished.
 */
export const updateLiveMatch = async (tournamentId: string, myPair: number, oppPair: number, scoreMy: number, scoreOpp: number, handNum: number) => {
    // 1. Normalize Keys (Pair A always smaller)
    const isASmaller = myPair < oppPair;
    const pairA = isASmaller ? myPair : oppPair;
    const pairB = isASmaller ? oppPair : myPair;
    const scoreA = isASmaller ? scoreMy : scoreOpp;
    const scoreB = isASmaller ? scoreOpp : scoreMy;

    try {
        const { error } = await supabase
            .from('live_matches')
            .upsert({
                tournament_id: tournamentId,
                pair_a: pairA,
                pair_b: pairB,
                score_a: scoreA,
                score_b: scoreB,
                hand_number: handNum,
                last_updated: new Date().toISOString()
            });

        if (error) throw error;
    } catch (e) {
        // Silent fail for live updates, don't block gameplay
        console.warn("⚠️ Live Update Failed:", e);
    }
};

/**
 * deleteLiveMatch
 * Removes the live record when the match finishes (cleanup).
 */
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


// --- V4 MULTIPLAYER SYNC (Jornada Compartida) ---

/**
 * setActiveTournament
 * Publishes the given tournament ID as the GLOBALLY ACTIVE tournament.
 * Called by Host upon finishing setup.
 */
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

/**
 * deactivateTournament
 * Clears the active tournament from the global configuration.
 * Stops clients from re-hydrating an ended tournament.
 */
export const deactivateTournament = async () => {
    console.log("🌍 SYNC: Deactivating GLOBAL tournament...");
    try {
        const { error } = await supabase
            .from('app_state')
            .upsert({
                key: 'global_config',
                value: { active_tournament_id: null }, // NULL kills the session
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("❌ SYNC ERROR (deactivate):", e);
        return { success: false, error: e.message };
    }
};

/**
 * fetchTournamentConfig
 * Recovers the full configuration (Host + Pairs) from Supabase
 * given a tournament ID. Used by Clients to "hydrate" their store.
 */
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

/**
 * getActiveTournamentId
 * One-shot check for the current active ID.
 */
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

/**
 * fetchMatches
 * Retrieves all completed matches for a given tournament.
 * Uses Relational Join to get Pair Numbers from IDs.
 */
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
