/**
 * @file lib/tournamentService.ts
 * @description Backend Service Facade.
 * @author Antigravity (Google Deepmind)
 * 
 * ROLE:
 * Bridges the gap between the Client (Browser) and the Database (Supabase).
 * Handles the "heavy lifting" of data archival so the frontend stays light.
 */

import { supabase } from "./supabase";

/**
 * Payload for Archiving a Tournament.
 * Includes everything needed to reconstruct the event later.
 */
interface ArchivePayload {
    tournamentId: string;
    host: string;
    pairs: any;       // The roster
    stats: any;       // The final leaderboard
    history: any[];   // Every single match played
}

/**
 * archiveTournament
 * Saves the full tournament state to the Cloud.
 * 
 * @param payload ArchivePayload
 * @returns { success: boolean, error?: string }
 */
export const archiveTournament = async ({ tournamentId, host, pairs, stats, history }: ArchivePayload) => {
    console.log("Service: Archiving tournament...", tournamentId);

    try {
        // 1. Insert the "Master Record" (The Header)
        const { data: tourney, error: tError } = await supabase
            .from('tournaments')
            .insert({
                id: tournamentId,
                date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
                host_name: host,
                status: 'completed',
                config: { pairs, stats, history } // Saving the JSON blob for easy retrieval
            })
            .select() // REQUIRED to get the 'tourney' object back
            .single();

        if (tError) {
            console.error("Supabase Error (Tournament):", tError);
            return { success: false, error: tError.message };
        }

        // 2. (Optional) Insert individual matches for granular analytics
        if (history && history.length > 0) {
            const matchesToInsert = history.map(m => ({
                tournament_id: tournamentId,
                pair_a: m.myPair,
                pair_b: m.oppPair,
                score_a: m.scoreMy,
                score_b: m.scoreOpp,
                winner_pair: m.scoreMy > m.scoreOpp ? m.myPair : m.oppPair,
                timestamp: new Date(m.timestamp).toISOString()
            }));

            // We use the ID from the created tournament record to ensure referential integrity
            const { error: mError } = await supabase
                .from('matches')
                .insert(matchesToInsert);

            if (mError) {
                console.warn("Supabase Warning (Matches):", mError);
                // We don't fail the whole process if granular matches fail, 
                // because the main blob is already saved.
            }
        }

        return { success: true };

    } catch (err: any) {
        console.error("Critical Service Error:", err);
        return { success: false, error: err.message || "Unknown error" };
    }
};
