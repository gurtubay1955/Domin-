"use client";

import { useEffect } from 'react';
import { useTournamentStore } from "@/lib/store";
import { supabase } from '@/lib/supabaseClient';
import { getActiveTournamentId, fetchTournamentConfig, fetchMatches } from '@/lib/tournamentService';

/**
 * GlobalSync
 * 
 * Component responsible for keeping the application state in sync with the cloud
 * NO MATTER WHICH PAGE THE USER IS ON.
 * 
 * Responsibilities:
 * 1. Listen for "Active Tournament" changes (Global App State)
 * 2. Listen for "New Matches" (Realtime)
 * 3. Polling Fallback (Every 10s) for reliability
 */
export default function GlobalSync() {
    const {
        tournamentId,
        isSetupComplete,
        hostName,
        pairUuidMap,
        initializeTournament,
        syncMatch,
        syncMatches,
        nuclearReset
    } = useTournamentStore();

    // 1. GLOBAL STATE SYNC (App State) - "Jornada Activa"
    useEffect(() => {
        const handleSync = async (cloudId: string | null) => {
            // A. If NULL (No active tournament) -> Reset
            if (!cloudId) {
                if (isSetupComplete && hostName) {
                    console.log("🌪️ SYNC: Tournament ended remotely. Triggering Nuclear Reset...");
                    nuclearReset();
                }
                return;
            }

            // B. If NEW ID or Missing Map -> Hydrate
            const currentId = useTournamentStore.getState().tournamentId;
            const currentMap = useTournamentStore.getState().pairUuidMap;
            const needsHydration = cloudId !== currentId || (cloudId === currentId && (!currentMap || Object.keys(currentMap).length === 0));

            if (needsHydration) {
                console.log("📥 SYNC: Hydrating Tournament Data...", { cloudId });

                // 1. Fetch Config
                const { success: cSuccess, config } = await fetchTournamentConfig(cloudId);

                if (cSuccess && config) {
                    // 2. Fetch History
                    const { success: mSuccess, matches } = await fetchMatches(cloudId);

                    if (mSuccess && matches) {
                        console.log(`💧 HYDRATING: ${matches.length} matches found.`);
                        initializeTournament(
                            config.id,
                            config.hostName,
                            config.pairs,
                            matches,
                            config.pairIds
                        );
                    }
                }
            }
        };

        // Check on Mount
        getActiveTournamentId().then((res) => {
            if (res.success && typeof res.activeId !== 'undefined') {
                handleSync(res.activeId);
            }
        });

        // Subscribe to Global Changes
        const channel = supabase.channel('global_sync_layout')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_state', filter: "key=eq.global_config" },
                (payload: any) => {
                    const newId = payload.new?.value?.active_tournament_id;
                    handleSync(newId);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isSetupComplete, hostName]); // Re-run if local state changes significantly


    // 2. MATCH SYNC (Realtime Gameplay) & POLLING
    useEffect(() => {
        if (!tournamentId) return;

        console.log("🔌 SYNC: Subscribing to matches (Global) for", tournamentId);

        // A. Realtime Subscription
        const channel = supabase.channel(`room_matches_global:${tournamentId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
                (payload: any) => {
                    const m = payload.new;
                    console.log("⚽ GLOBAL MATCH EVENT:", m.id);

                    const currentMap = useTournamentStore.getState().pairUuidMap;
                    const pairANum = currentMap[m.pair_a_id] || 0;
                    const pairBNum = currentMap[m.pair_b_id] || 0;

                    if (pairANum === 0 || pairBNum === 0) {
                        console.warn("⚠️ SYNC WARN: Unmapped pairs in realtime event.");
                    }

                    const matchRecord = {
                        id: m.id,
                        tournamentId: m.tournament_id,
                        myPair: pairANum,
                        oppPair: pairBNum,
                        scoreMy: m.score_a,
                        scoreOpp: m.score_b,
                        oppNames: m.pair_b_names || ["?", "?"],
                        timestamp: m.timestamp,
                        handsMy: m.hands_a,
                        handsOpp: m.hands_b,
                        isZapatero: m.termination_type
                    };

                    syncMatch(matchRecord);
                }
            )
            .subscribe();

        // B. V4.2 POLLING FALLBACK (Every 10s)
        const intervalId = setInterval(async () => {
            // console.log("🔄 GLOBAL POLLING: Checking for new matches...");
            const { success, matches } = await fetchMatches(tournamentId);
            if (success && matches && matches.length > 0) {
                const { syncMatches } = useTournamentStore.getState();
                syncMatches(matches);
            }
        }, 10000); // 10 seconds

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };

    }, [tournamentId]); // Only re-sub if tournamentId changes

    return null; // This component renders nothing, just logic
}
