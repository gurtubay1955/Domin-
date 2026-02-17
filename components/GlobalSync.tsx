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
                    console.log("📥 RAW LIVE_MATCHES PAYLOAD:", payload);
                    const { syncLiveMatch } = useTournamentStore.getState();

                    if (payload.eventType === 'DELETE') {
                        // We rely on the store's syncMatch logic (when final match arrives) to clear it,
                        // OR we could explicitly clear it here.
                        // For now, let's just log. Clearing is handled by 'addMatch' or 'syncMatch' usually.
                        // Actually, better to clear it if we can. 
                        // But payload.old only has ID usually? No, supabase sends full OLD record for REPLICA identity full?
                        // Default identity is PK. PK is tournament_id, pair_a, pair_b.
                        // So payload.old should have those.
                        // Let's implement specific delete action later if needed. 
                        // For now, the "Completed Match" event arriving (Step A) clears it.
                        // BUT if someone just exits the game without saving? Then it lingers.
                        // Use deleteLiveMatch in ScoreBoard clears it.
                        console.log("🗑️ LIVE_MATCHES DELETE event");
                        return;
                    }

                    const m = payload.new;
                    console.log(`🔴 LIVE SYNC EVENT: ${m.pair_a} vs ${m.pair_b} (${m.score_a}-${m.score_b}, hand=${m.hand_number})`);

                    syncLiveMatch({
                        tournamentId: m.tournament_id,
                        pairA: m.pair_a,
                        pairB: m.pair_b,
                        scoreA: m.score_a,
                        scoreB: m.score_b,
                        handNumber: m.hand_number,
                        lastUpdated: m.last_updated
                    });

                    console.log("✅ syncLiveMatch called - store should be updated");
                }
            )
            .subscribe((status) => {
                console.log("📡 live_matches subscription status:", status);
            });

        // C. V4.2 POLLING FALLBACK (Every 10s) - Completed Matches
        const matchesIntervalId = setInterval(async () => {
            // console.log("🔄 GLOBAL POLLING: Checking for new matches...");
            const { success, matches } = await fetchMatches(tournamentId);
            if (success && matches && matches.length > 0) {
                const { syncMatches } = useTournamentStore.getState();
                syncMatches(matches);
            }
        }, 10000); // 10 seconds

        // D. V4.9 POLLING FALLBACK FOR LIVE MATCHES (Every 5s)
        // Safari mobile suspends WebSocket connections when app goes to background
        const liveMatchesIntervalId = setInterval(async () => {
            console.log("🔄 POLLING: Checking live_matches...");
            const { data, error } = await supabase
                .from('live_matches')
                .select('*')
                .eq('tournament_id', tournamentId);

            if (error) {
                console.error("❌ Polling error:", error);
                return;
            }

            if (data && data.length > 0) {
                const { syncLiveMatch } = useTournamentStore.getState();
                data.forEach((m: any) => {
                    console.log(`🔄 POLLING: Found live match ${m.pair_a} vs ${m.pair_b}`);
                    syncLiveMatch({
                        tournamentId: m.tournament_id,
                        pairA: m.pair_a,
                        pairB: m.pair_b,
                        scoreA: m.score_a,
                        scoreB: m.score_b,
                        handNumber: m.hand_number,
                        lastUpdated: m.last_updated
                    });
                });
            }
        }, 5000); // 5 seconds

        return () => {
            supabase.removeChannel(channel);
            clearInterval(matchesIntervalId);
            clearInterval(liveMatchesIntervalId);
        };

    }, [tournamentId]); // Only re-sub if tournamentId changes

    return null; // This component renders nothing, just logic
}
