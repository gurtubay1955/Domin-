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
import { Users, AlertCircle, PlayCircle, History, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTournamentStore } from "@/lib/store"; // Quantum Store

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
     */
    const handleStartMatch = () => {
        if (!myPairNum || !opponentPairNum) return;

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

    if (!currentUser || !myPairNum) return null; // Wait for hydration

    return (
        <div className="min-h-screen bg-[#4A3B32] text-[#FDFBF7] font-hand p-4 pb-20">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Mesa de Control</h1>
                    <p className="opacity-60 text-sm">
                        Hola, <span className="text-[#A5D6A7] font-bold">{currentUser}</span>
                        <br />
                        Pareja #{myPairNum} (con {myPartner})
                    </p>
                </div>

                <div className="bg-white/5 px-4 py-2 rounded-lg text-center border border-white/5">
                    <p className="text-xs opacity-50 uppercase tracking-widest">JUGADAS</p>
                    <p className="text-xl font-bold">{filteredHistory.length}</p>
                </div>
            </div>

            {/* Main Action Area */}
            <div className="space-y-6 max-w-lg mx-auto">

                {/* 1. Select Rival */}
                <div className="bg-black/20 p-6 rounded-3xl backdrop-blur-sm border border-white/5 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-[#A5D6A7]/20 flex items-center justify-center text-[#A5D6A7]">
                            <Users size={20} />
                        </div>
                        <h2 className="text-2xl font-bold">Elegir Rival</h2>
                    </div>

                    {availableOpponents.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 bg-[#FFD54F]/20 rounded-full flex items-center justify-center text-[#FFD54F] mx-auto mb-4 animate-pulse">
                                <Trophy size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-[#FFD54F] mb-2">¡Jornada Completada!</h3>
                            <p className="opacity-60 text-sm">
                                Has jugado contra todas las parejas posibles.
                                <br />¡A relajarse!
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {availableOpponents.map(([numStr, names]) => {
                                const pNum = parseInt(numStr);
                                const isSelected = opponentPairNum === pNum;

                                return (
                                    <button
                                        key={pNum}
                                        onClick={() => setOpponentPairNum(pNum)}
                                        className={`
                                            relative flex items-center justify-between p-4 rounded-xl transition-all duration-300 border
                                            ${isSelected
                                                ? 'bg-[#A5D6A7] text-[#1B5E20] border-[#A5D6A7] scale-[1.02] shadow-lg'
                                                : 'bg-white/5 hover:bg-white/10 border-white/5 text-white/80'}
                                        `}
                                    >
                                        <div className="flex items-center gap-4 w-full">
                                            <div className="text-left w-full">
                                                <p className="font-bold text-xl leading-tight">
                                                    {names.join(" y ")}
                                                </p>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <motion.div layoutId="check" className="bg-[#1B5E20]/20 p-1 rounded-full">
                                                <div className="w-2 h-2 bg-[#1B5E20] rounded-full" />
                                            </motion.div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 2. Action Button */}
                <button
                    onClick={handleStartMatch}
                    disabled={!opponentPairNum}
                    className={`
                        w-full py-5 rounded-2xl font-black text-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)]
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
                        <div className="flex items-center gap-2 mb-4 opacity-50">
                            <History size={16} />
                            <h3 className="text-sm font-bold uppercase tracking-widest">Resultados</h3>
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

                                return (
                                    <div key={idx} className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center justify-between relative overflow-hidden">

                                        {/* Winner Side (Left) - Green */}
                                        <div className="flex items-center gap-3 z-10 w-[48%]">
                                            <div className="flex flex-col text-left leading-tight min-w-0">
                                                {winnerNames.map((name, i) => (
                                                    <span key={i} className="text-sm font-bold text-[#A5D6A7] drop-shadow-md truncate">
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-2xl font-black text-[#A5D6A7] ml-auto">{winnerScore}</span>
                                        </div>

                                        {/* Divider */}
                                        <div className="h-full w-px bg-white/10 mx-1" />

                                        {/* Loser Side (Right) - Red */}
                                        <div className="flex items-center gap-3 z-10 w-[48%] flex-row-reverse">
                                            <div className="flex flex-col text-right leading-tight min-w-0">
                                                {loserNames.map((name, i) => (
                                                    <span key={i} className="text-sm font-bold text-[#EF9A9A] drop-shadow-md truncate">
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-2xl font-black text-[#EF9A9A] mr-auto">{loserScore}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Global Progress Indicator */}
            <div className="mt-12 text-center">
                <p className="text-[10px] opacity-30 uppercase tracking-[0.2em] mb-2">Progreso Global de la Jornada</p>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden max-w-xs mx-auto">
                    <div
                        className="h-full bg-[#A5D6A7]"
                        style={{ width: `${Math.min(100, (matchHistory.length / totalExpectedTournament) * 100)}%` }}
                    />
                </div>
                <p className="text-xs opacity-50 mt-2 font-mono">{matchHistory.length} / {totalExpectedTournament} Partidas</p>

                {matchHistory.length >= totalExpectedTournament && (
                    <button
                        onClick={() => router.push('/results')}
                        className="mt-6 px-6 py-3 bg-[#FFD700] text-[#4A3B32] font-black rounded-xl shadow-lg hover:scale-105 transition-all text-sm uppercase tracking-wider"
                    >
                        Ver Tabla Final
                    </button>
                )}
            </div>
        </div>
    );
}
