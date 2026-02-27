"use client";

/**
 * @file app/table-select/page.tsx
 * @description The "Lobby". Players choose their opponent here.
 * @author Antigravity (Google Deepmind)
 * 
 * DESIGN UPDATE (Phase 3):
 * - Match History now shows FULL NAMES (stacked).
 * - Winners in GREEN (Left), Losers in RED (Right).
 * - Optimized for clarity.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Users, AlertCircle, PlayCircle, History, Trophy, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTournamentStore } from "@/lib/store"; // Quantum Store
import { supabase } from "@/lib/supabaseClient"; // Supabase Client for Live V3.1

export default function TableSelectPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState("");

    // QUANTUM UPGRADE: Connect to Store
    const {
        isSetupComplete,
        pairs,
        matchHistory,
        tournamentId
    } = useTournamentStore();

    // Data mapped for easy access
    // We want a map of PairID -> PlayerNames[]
    // 'pairs' from store is already Record<string, string[]>

    // My Info
    const [myPairNum, setMyPairNum] = useState<number | null>(null);
    const [myPartner, setMyPartner] = useState<string>("");

    // Opponent Selection
    const [opponentPairNum, setOpponentPairNum] = useState<number | "">("");

    // V6.4: Magic Reconnect State
    const [orphanMatch, setOrphanMatch] = useState<any>(null);
    const [isCheckingOrphan, setIsCheckingOrphan] = useState(false);

    useEffect(() => {
        // 0. GUARD: Ensure tournament is configured
        if (!isSetupComplete || Object.keys(pairs).length === 0) {
            console.warn("TableSelect: Setup not complete. Redirecting to home.");
            router.push("/");
            return;
        }

        // 1. GET USER SESSION
        const user = sessionStorage.getItem("currentUser");
        if (!user) {
            router.push("/login"); // Kick to login if session expired
            return;
        }
        setCurrentUser(user);

        // 2. IDENTIFY SELF (Find which pair I belong to from Store)
        let foundPairNum: number | null = null;
        Object.entries(pairs).forEach(([numStr, players]) => {
            if (players.includes(user)) {
                foundPairNum = parseInt(numStr);
                setMyPairNum(foundPairNum);
                // Find partner (the other person in my pair)
                const partner = players.find(p => p !== user);
                setMyPartner(partner || "Desconocido");
            }
        });

    }, [router, isSetupComplete, pairs]);

    // V6.4: MAGIC RECONNECT CHECKER
    useEffect(() => {
        if (!tournamentId || !myPairNum || orphanMatch) return;

        const checkOrphanMatch = async () => {
            setIsCheckingOrphan(true);
            try {
                const { checkActiveMatchForPair } = await import('@/lib/tournamentService');
                const result = await checkActiveMatchForPair(tournamentId, myPairNum);

                if (result.success && result.hasActiveMatch) {
                    // Solo consideramos partidas vivas aquellas que ya empezaron (hand_number > 0)
                    // o incluso las que apenas se sentaron (hand_number = 0)
                    console.warn("⚠️ MAGIC RECONNECT: Orphan match detected!", result.matchData);
                    setOrphanMatch(result.matchData);
                }
            } catch (err) {
                console.error("Error checking orphan match", err);
            } finally {
                setIsCheckingOrphan(false);
            }
        };

        checkOrphanMatch();
    }, [tournamentId, myPairNum]);

    // DEBUG: Inspect Match History
    useEffect(() => {
        console.log("🔍 DEBUG: CURRENT MATCH HISTORY:", matchHistory);
        matchHistory.forEach(m => {
            console.log(`- Match ID: ${m.id} | Pairs: ${m.myPair} vs ${m.oppPair} | Score: ${m.scoreMy}-${m.scoreOpp}`);
        });
    }, [matchHistory]);

    /**
     * CALCULATE AVAILABLE OPPONENTS (The Core Algorithm)
     * QUANTUM UPGRADE: Uses store data + useMemo.
     */
    const availableOpponents = useMemo(() => {
        if (!myPairNum) return [];

        return Object.entries(pairs).filter(([numStr, players]) => {
            const pNum = parseInt(numStr);
            if (pNum === myPairNum) return false; // Can't play against self

            // Check if a match exists in history involving both pairs
            const alreadyPlayed = matchHistory.some(m =>
                (m.myPair === myPairNum && m.oppPair === pNum) ||
                (m.myPair === pNum && m.oppPair === myPairNum) // Bidirectional check
            );
            return !alreadyPlayed;
        });
    }, [pairs, matchHistory, myPairNum]);

    /**
     * handleStartMatch
     * Prepares the game session and redirects to the ScoreBoard.
     * 🔴 V4.8: NOW updates live_matches IMMEDIATELY for real-time sync
     */
    const handleStartMatch = async () => {
        console.log("🎯 handleStartMatch called", { myPairNum, opponentPairNum, tournamentId });

        if (!myPairNum || !opponentPairNum || !tournamentId) {
            console.error("❌ Missing required data:", { myPairNum, opponentPairNum, tournamentId });
            return;
        }

        // 🔴 V4.8: Create live_matches entry IMMEDIATELY
        // This notifies all other devices that these pairs are now "seated at a table"
        try {
            console.log("📤 Attempting to update live_matches...");
            const { updateLiveMatch } = await import('@/lib/tournamentService');

            const result = await updateLiveMatch(
                tournamentId,
                myPairNum,
                opponentPairNum,
                0, // Initial score
                0,
                0  // hand_number = 0 means "seated but haven't started playing yet"
            );

            console.log('✅ V4.8: Opponents marked as SEATED in live_matches', result);
        } catch (error) {
            console.error('❌ Failed to update live_matches:', error);
            // Don't block the user, just log the error
        }

        // Create a Session Config Object for the Game Page
        // (This remains transient session state, not store state, because it's "in progress")
        const matchConfig = {
            scorer: currentUser,
            myPair: myPairNum,
            opponentPair: opponentPairNum,
            myPartner: myPartner,
            oppNames: pairs[opponentPairNum.toString()]
        };

        const configStr = JSON.stringify(matchConfig);
        localStorage.setItem("activeMatch", configStr);
        sessionStorage.setItem("activeMatch", configStr);

        console.log("🚀 Navigating to /game...");
        router.push("/game");
    };

    /**
     * handleResumeMatch (V6.4)
     * Resucita la sesión perdida usando los datos de la nube
     */
    const handleResumeMatch = () => {
        if (!orphanMatch) return;
        console.log("🔄 Resuming orphaned match...", orphanMatch);

        const isPairA = orphanMatch.pair_a === myPairNum;
        const opponentPairNum = isPairA ? orphanMatch.pair_b : orphanMatch.pair_a;

        // Rebuild Session Config Object
        const matchConfig = {
            scorer: currentUser,
            myPair: myPairNum,
            opponentPair: opponentPairNum,
            myPartner: myPartner,
            oppNames: pairs[opponentPairNum.toString()] || ["Desconocido 1", "Desconocido 2"]
        };

        const configStr = JSON.stringify(matchConfig);
        localStorage.setItem("activeMatch", configStr);
        sessionStorage.setItem("activeMatch", configStr);

        console.log("🚀 Navigating to /game for resume...");
        router.push("/game");
    };

    // Filter history for current user - Fix for "Partidas Jugadas (X)" count
    const filteredHistory = useMemo(() => {
        return matchHistory.filter(m =>
            myPairNum && (m.myPair === myPairNum || m.oppPair === myPairNum)
        );
    }, [matchHistory, myPairNum]);

    // Calculate Tournament Progress
    const numPairs = Object.keys(pairs).length;
    const totalExpectedTournament = numPairs > 0 ? (numPairs * (numPairs - 1)) / 2 : 0;
    const totalExpectedPerPair = numPairs > 0 ? numPairs - 1 : 0;

    /**
     * Helper: Get games played for a specific pair
     */
    const getGamesPlayed = (pairId: number) => {
        return matchHistory.filter(m => m.myPair === pairId || m.oppPair === pairId).length;
    };

    if (!currentUser || !myPairNum) return null; // Wait for hydration

    return (
        <div className="min-h-screen bg-[#4A3B32] text-[#FDFBF7] font-hand p-4 pb-20">
            {/* Header */}
            <div className="flex flex-col items-center justify-center text-center relative mb-10 pt-6">
                <div className="z-10 bg-[#4A3B32]/80 backdrop-blur-sm p-4 rounded-3xl border border-white/5 shadow-2xl relative">
                    <h1 className="text-5xl font-black mb-2 tracking-tight text-[#FFD54F] drop-shadow-md">Mesa de Control</h1>
                    <p className="opacity-80 text-2xl font-medium">
                        Hola, <span className="text-[#A5D6A7] font-bold">{currentUser}</span>
                    </p>
                    <p className="opacity-60 text-2xl mb-2">
                        Pareja #{myPairNum} (con {myPartner})
                    </p>

                    {/* 🔧 V5.1 DEBUG: ID VISIBILITY & MANUAL SYNC */}
                    <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-white/10">
                        <span className="text-xs font-mono opacity-30 tracking-widest">
                            ID: {tournamentId?.slice(0, 8)}...
                        </span>
                        <button
                            onClick={() => {
                                const { syncMatches } = useTournamentStore.getState();
                                // Manual Trigger
                                import('@/lib/tournamentService').then(async ({ fetchMatches }) => {
                                    if (tournamentId) {
                                        const { success, matches } = await fetchMatches(tournamentId);
                                        if (success && matches) {
                                            syncMatches(matches);
                                            alert(`✅ Sincronizado: ${matches.length} partidas encontradas.`);
                                        } else {
                                            alert("⚠️ Error al sincronizar.");
                                        }
                                    }
                                });
                            }}
                            className="p-1.5 bg-white/5 rounded-full hover:bg-white/20 transition-all text-xs font-bold text-[#A5D6A7] flex items-center gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
                            SYNC
                        </button>
                    </div>
                </div>
            </div>

            {/* V6.4: MAGIC RECONNECT BANNER */}
            <AnimatePresence>
                {orphanMatch && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        className="max-w-lg mx-auto mb-8"
                    >
                        <div className="bg-red-500/20 border-2 border-red-500/50 p-6 rounded-3xl backdrop-blur-md shadow-[0_0_30px_rgba(239,83,80,0.3)]">
                            <div className="flex items-center gap-4 mb-4">
                                <AlertCircle className="text-red-400 animate-pulse" size={32} />
                                <div>
                                    <h3 className="text-2xl font-black text-white">¡Partida en Progreso!</h3>
                                    <p className="opacity-90 leading-tight">Tienes un partido abierto en la Mesa.</p>
                                </div>
                            </div>

                            <button
                                onClick={handleResumeMatch}
                                className="w-full mt-2 bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-2xl py-4 rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20"
                            >
                                <RotateCw size={24} />
                                Reanudar Anotación
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Action Area */}
            <div className="space-y-6 max-w-lg mx-auto">

                {/* 1. Select Rival */}
                <div className="bg-black/20 p-6 rounded-3xl backdrop-blur-sm border border-white/5 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-[#A5D6A7]/20 flex items-center justify-center text-[#A5D6A7]">
                            <Users size={20} />
                        </div>
                        <h2 className="text-4xl font-black ml-2 text-white">Elegir Rival</h2>
                    </div>

                    {availableOpponents.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 bg-[#FFD54F]/20 rounded-full flex items-center justify-center text-[#FFD54F] mx-auto mb-4 animate-pulse">
                                <Trophy size={40} />
                            </div>
                            <h3 className="text-3xl font-bold text-[#FFD54F] mb-4">¡Jornada Completada!</h3>
                            <p className="opacity-80 text-2xl font-medium">
                                Han jugado contra todas las parejas posibles.
                                <br />¡A relajarse!
                            </p>
                        </div>
                    ) : (
                        // LIVE MATCHES from Global Store
                        <LiveMatchesRender
                            availableOpponents={availableOpponents}
                            opponentPairNum={opponentPairNum}
                            setOpponentPairNum={setOpponentPairNum}
                            totalExpectedPerPair={totalExpectedPerPair}
                            getGamesPlayed={getGamesPlayed}
                        />
                    )}
                </div>

                {/* 2. Action Button */}
                <button
                    onClick={handleStartMatch}
                    disabled={!opponentPairNum}
                    className={`
                        w-full py-6 rounded-2xl font-black text-4xl shadow-[0_8px_30px_rgba(0,0,0,0.3)]
                        flex items-center justify-center gap-3 transition-all duration-300
                        ${opponentPairNum
                            ? 'bg-gradient-to-r from-[#FF7043] to-[#FF5722] text-white hover:scale-105 active:scale-95'
                            : 'bg-white/5 text-white/10 cursor-not-allowed'}
                    `}
                >
                    <PlayCircle size={32} />
                    ¡A LA MESA!
                </button>

                {/* 3. Recent History (Redesigned Phase 3) */}
                {filteredHistory.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-white/5">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2 opacity-50">
                                <History size={20} />
                                <h3 className="text-xl font-bold uppercase tracking-widest">Resultados</h3>
                            </div>

                            {/* Current Pair Game Counter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold opacity-60 uppercase tracking-widest hidden sm:block">JUEGOS JUGADOS</span>
                                <div className="w-16 h-16 flex items-center justify-center rounded-xl border border-[#A5D6A7]/30 bg-[#A5D6A7]/10 text-[#A5D6A7]">
                                    <span className="text-2xl font-black font-mono">
                                        {myPairNum ? getGamesPlayed(myPairNum) : 0}/{totalExpectedPerPair}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {filteredHistory.map((match, idx) => {
                                // Determine Winners and Losers for clear display
                                const pairAWon = match.scoreMy > match.scoreOpp;

                                // Get Names from Store (or match record if cached)
                                const pairANames = pairs[match.myPair.toString()] || ["?", "?"];
                                const pairBNames = match.oppNames || pairs[match.oppPair.toString()] || ["?", "?"];

                                const winnerNames = pairAWon ? pairANames : pairBNames;
                                const winnerScore = pairAWon ? match.scoreMy : match.scoreOpp;

                                const loserNames = pairAWon ? pairBNames : pairANames;
                                const loserScore = pairAWon ? match.scoreOpp : match.scoreMy;

                                // Get Loser Pair ID to show their record
                                const loserPairId = pairAWon ? match.oppPair : match.myPair;
                                const loserGamesPlayed = getGamesPlayed(loserPairId);

                                return (
                                    <div key={idx} className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col gap-2 relative overflow-hidden">

                                        {/* Row Layout: Winner Left | Loser Right */}
                                        <div className="flex items-center justify-between gap-2">

                                            {/* WINNER SIDE */}
                                            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                                <div className="flex flex-col text-left leading-tight min-w-0 pr-1">
                                                    {winnerNames.map((name, i) => (
                                                        <span key={i} className="text-2xl font-black text-[#A5D6A7] drop-shadow-md truncate block">
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                                <span className="text-3xl font-black text-[#A5D6A7] whitespace-nowrap">{winnerScore}</span>
                                            </div>

                                            {/* VERTICAL DIVIDER */}
                                            <div className="h-10 w-px bg-white/10" />

                                            {/* LOSER SIDE (Realigned: Name - Score - Record) */}
                                            <div className="flex items-center gap-2 flex-1 justify-start min-w-0 overflow-hidden">
                                                <div className="flex flex-col text-left leading-tight min-w-0 pl-1">
                                                    {loserNames.map((name, i) => (
                                                        <span key={i} className="text-2xl font-black text-[#EF9A9A] drop-shadow-md truncate block">
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="flex flex-col items-center">
                                                    <span className="text-3xl font-black text-[#EF9A9A]">{loserScore}</span>
                                                </div>

                                                {/* Square Game Counter for Loser */}
                                                <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-lg border border-[#A5D6A7]/30 bg-[#A5D6A7]/10 text-[#A5D6A7] ml-auto">
                                                    <span className="text-xl font-bold font-mono">
                                                        {loserGamesPlayed}/{totalExpectedPerPair}
                                                    </span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Global Progress Indicator */}
            <div className="mt-12 text-center max-w-lg mx-auto">
                <p className="text-2xl font-bold opacity-80 uppercase tracking-widest mb-4 text-white">Progreso Global de la Jornada</p>
                <div className="w-full h-8 bg-white/5 rounded-xl overflow-hidden border border-white/10 relative">
                    <div
                        className="h-full bg-[#A5D6A7] transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(100, (matchHistory.length / totalExpectedTournament) * 100)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-xl font-bold text-[#1B5E20] drop-shadow-sm">
                            {matchHistory.length} / {totalExpectedTournament}
                        </p>
                    </div>
                </div>
                <p className="text-3xl font-black mt-6 text-[#A5D6A7]">{matchHistory.length} / {totalExpectedTournament} Partidas</p>

                {matchHistory.length >= totalExpectedTournament && (
                    <button
                        onClick={() => router.push('/results')}
                        className="mt-6 px-8 py-4 bg-[#FFD700] text-[#4A3B32] font-black rounded-xl shadow-lg hover:scale-105 transition-all text-2xl uppercase tracking-wider"
                    >
                        Ver Tabla Final
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * LIVE MATCHES RENDERER (Pure Component - No Subscription)
 * Uses global store state via props or directly if connected.
 * Since we passed props safely via parent, we can just use store here too or props.
 * Let's use the store directly for cleaner code in NextJS client components.
 */
function LiveMatchesRender({
    availableOpponents,
    opponentPairNum,
    setOpponentPairNum,
    totalExpectedPerPair,
    getGamesPlayed
}: any) {
    // 🔴 V4.9 FIX: Use Global Store directly
    const { liveScores } = useTournamentStore();

    return (
        <div className="grid grid-cols-1 gap-3">
            {availableOpponents.map(([numStr, names]: [string, string[]]) => {
                const pNum = parseInt(numStr);
                const isSelected = opponentPairNum === pNum;
                const gamesPlayed = getGamesPlayed(pNum);

                // Check active status
                // liveScores keys are "min-max"
                const activeMatch = Object.entries(liveScores).find(([key]) => key.startsWith(`${pNum}-`) || key.endsWith(`-${pNum}`));

                let liveBadge = null;
                if (activeMatch) {
                    const [key, data] = activeMatch;
                    const [pA, pB] = key.split('-').map(Number);
                    const isPairA = pNum === pA;
                    const myScore = isPairA ? data.scoreA : data.scoreB;
                    const oppScore = isPairA ? data.scoreB : data.scoreA;
                    const handNumber = data.handNumber || 0;

                    // 🔴 V4.8: Distinguish between SEATED (hand=0) and PLAYING (hand>0)
                    if (handNumber === 0) {
                        // Just seated, haven't started playing yet
                        liveBadge = (
                            <div className="absolute top-2 right-2 bg-orange-500/90 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse shadow-lg z-20">
                                🪑 EN MESA
                            </div>
                        );
                    } else {
                        // Actively playing
                        liveBadge = (
                            <div className="absolute top-2 right-2 bg-red-500/90 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse shadow-lg z-20">
                                🎲 JUGANDO: {myScore} - {oppScore}
                            </div>
                        );
                    }
                }

                const isOccupied = !!activeMatch; // V4.9: Pair is unavailable if playing

                return (
                    <button
                        key={pNum}
                        onClick={() => !isOccupied && setOpponentPairNum(pNum)}
                        disabled={isOccupied}
                        className={`
                            relative flex items-center justify-between p-3 rounded-xl transition-all duration-300 border
                            ${isOccupied
                                ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-60'
                                : isSelected
                                    ? 'bg-[#A5D6A7] text-[#1B5E20] border-[#A5D6A7] scale-[1.02] shadow-lg'
                                    : 'bg-white/5 hover:bg-white/10 border-white/5 text-white/80 cursor-pointer'
                            }
                        `}
                    >
                        {liveBadge}

                        <div className="flex items-center gap-4 w-full">
                            {/* Names */}
                            <div className="text-left flex-1 min-w-0">
                                <p className="font-bold text-3xl leading-snug truncate text-white">
                                    {names.join(" y ")}
                                </p>
                            </div>

                            {/* Game Counter */}
                            <div className={`
                                flex-shrink-0 w-16 h-16 flex items-center justify-center rounded-lg border-2
                                ${isSelected
                                    ? 'border-[#1B5E20] bg-[#1B5E20]/10 text-[#1B5E20]'
                                    : 'border-white/10 bg-black/20 text-white/40'}
                            `}>
                                <span className="text-2xl font-bold font-mono">
                                    {gamesPlayed}/{totalExpectedPerPair}
                                </span>
                            </div>
                        </div>

                        {isSelected && (
                            <motion.div layoutId="check" className="absolute -top-1 -right-1 bg-[#1B5E20] w-4 h-4 rounded-full border-2 border-[#A5D6A7]" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
