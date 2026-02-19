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
            console.log(`🔍 GLOBAL SYNC: Received cloudId=${cloudId}, currentSetup=${isSetupComplete}, currentHost=${hostName}`);

            // A. If NULL (No active tournament) -> Reset
            if (!cloudId) {
                if (isSetupComplete && hostName) {
                    console.log("🌪️ SYNC: Tournament ended remotely. Triggering Nuclear Reset...");
                    // Auto-reload without blocking alert
                    nuclearReset();
                } else {
                    console.log("ℹ️ SYNC: NULL tournament but no local state, ignoring.");
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
                    // 2. Fetch History (Initial Full Load)
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
            } else {
                // 🔴 V5 FIX: ALWAYS FETCH HISTORY ON SYNC (Catch-up)
                // Even if we are already hydrated, we might have missed matches while backgrounded/offline.
                // This ensures the "Global Progress Bar" is accurate for everyone.
                console.log("📥 SYNC: Verifying Global Match History (Catch-up)...", { cloudId });
                const { success: mSuccess, matches } = await fetchMatches(cloudId);
                if (mSuccess && matches) {
                    // console.log(`💧 CATCH-UP: ${matches.length} matches found.`);
                    syncMatches(matches);
                }
            }
        };

        // Check on Mount
        getActiveTournamentId().then((res) => {
            if (res.success && typeof res.activeId !== 'undefined') {
                console.log("🚀 GLOBAL SYNC: Initial check on mount, activeId=", res.activeId);
                handleSync(res.activeId);
            }
        });

        // Subscribe to Global Changes
        const channel = supabase.channel('global_sync_layout')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_state', filter: "key=eq.global_config" },
                (payload: any) => {
                    console.log("🔥 GLOBAL SYNC EVENT:", payload);
                    const newId = payload.new?.value?.active_tournament_id;
                    console.log(`📡 Extracted newId from payload: ${newId}`);
                    handleSync(newId);
                }
            )
            .subscribe();

        // POLLING FALLBACK: Check every 5 seconds for reset
        // This handles Safari mobile suspending WebSocket connections
        const pollInterval = setInterval(async () => {
            const res = await getActiveTournamentId();
            if (res.success && typeof res.activeId !== 'undefined') {
                const currentId = useTournamentStore.getState().tournamentId;

                // Detect reset: we have local tournament but cloud says null
                if (res.activeId === null && currentId && isSetupComplete) {
                    console.log("🔄 POLLING: Detected reset via polling!");
                    handleSync(null);
                }
            }
        }, 5000); // Every 5 seconds

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, [isSetupComplete, hostName]); // Re-run if local state changes significantly


    // 2. MATCH SYNC (Realtime Gameplay) & POLLING
    useEffect(() => {
        if (!tournamentId) return;

        console.log("🔌 SYNC: Subscribing to matches (Global) for", tournamentId);

        // A. Realtime Subscription (Completed Matches)
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
            // 🔴 B. V4.5 LIVE SCORES Subscription
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'live_matches', filter: `tournament_id=eq.${tournamentId}` },
                (payload: any) => {
                    // console.log("📥 RAW LIVE_MATCHES PAYLOAD:", payload);
                    const { syncLiveMatch, removeLiveScore } = useTournamentStore.getState();

                    if (payload.eventType === 'DELETE') {
                        const old = payload.old;
                        console.log("🗑️ LIVE_MATCHES DELETE event:", old);
                        // We need pair_a and pair_b
                        // Supabase replica identity 'FULL' is needed to get old values, 
                        // OR if it's the PK. Our PK is (tournament_id, pair_a, pair_b).
                        // So payload.old SHOULD contain them.
                        if (old && old.pair_a && old.pair_b) {
                            removeLiveScore(old.pair_a, old.pair_b);
                        } else {
                            // If we don't get IDs, we can't remove seamlessly. 
                            // Fallback: Polling will clean it up in <2s.
                            console.warn("⚠️ DELETE event missing keys. Waiting for polling to cleanup.");
                        }
                        return;
                    }

                    const m = payload.new;
                    // console.log(`🔴 LIVE SYNC EVENT: ${m.pair_a} vs ${m.pair_b}`);

                    // 🛡️ ZOMBIE SHIELD: Handled inside store now via `syncLiveMatch` logic?
                    // Actually store logic has the check.
                    syncLiveMatch({
                        tournamentId: m.tournament_id,
                        pairA: m.pair_a,
                        pairB: m.pair_b,
                        scoreA: m.score_a,
                        scoreB: m.score_b,
                        handNumber: m.hand_number,
                        lastUpdated: m.last_updated
                    });
                }
            )
            .subscribe((status) => {
                console.log("📡 live_matches subscription status:", status);
            });

        // C. V4.2 POLLING FALLBACK (Every 5s) - Completed Matches
        const matchesIntervalId = setInterval(async () => {
            // console.log("🔄 GLOBAL POLLING: Checking for new matches...");
            const { success, matches } = await fetchMatches(tournamentId);
            if (success && matches && matches.length > 0) {
                const { syncMatches } = useTournamentStore.getState();
                syncMatches(matches);
            }
        }, 5000); // 5 seconds (Reduced from 10s for better responsiveness)

        // D. V5.0 AUTHORITATIVE POLLING FOR LIVE MATCHES (Every 2s)
        // REPLACES "Additive Only" with "Full Replace"
        const liveMatchesIntervalId = setInterval(async () => {
            // console.log("🔄 POLLING: Checking live_matches (2s)...");
            const { data, error } = await supabase
                .from('live_matches')
                .select('*')
                .eq('tournament_id', tournamentId);

            if (error) {
                console.error("❌ Polling error:", error);
                return;
            }

            // ALWAYS UPDATE STORE using setLiveScores
            // If data is empty [], store becomes empty {}. ZOMBIES KILLED.
            const { setLiveScores } = useTournamentStore.getState();

            const cleanList = (data || []).map((m: any) => ({
                tournamentId: m.tournament_id,
                pairA: m.pair_a,
                pairB: m.pair_b,
                scoreA: m.score_a,
                scoreB: m.score_b,
                handNumber: m.hand_number,
                lastUpdated: m.last_updated
            }));

            setLiveScores(cleanList);

        }, 2000); // 2 seconds (CRITICAL REQUIREMENT)

        return () => {
            supabase.removeChannel(channel);
            clearInterval(matchesIntervalId);
            clearInterval(liveMatchesIntervalId);
        };

    }, [tournamentId]); // Only re-sub if tournamentId changes

    return null; // This component renders nothing, just logic
}
