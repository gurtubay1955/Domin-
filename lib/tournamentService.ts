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
