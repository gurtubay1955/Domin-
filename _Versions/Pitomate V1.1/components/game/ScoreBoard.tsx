"use client";

/**
 * @file components/game/ScoreBoard.tsx
 * @description The main Gameplay Screen (Digital Score Sheet).
 * @author Antigravity (Google Deepmind)
 * 
 * RESPONSIBILITIES:
 * 1. Tracking points for "Nosotros" (Team A) and "Ellos" (Team B).
 * 2. Visualizing the target score (100 points).
 * 3. Entering points via a custom Numpad.
 * 4. DETECTING VICTORY: When a team >= 100 points.
 * 5. SAVING: Committing the result to history via Zustand Store.
 */

import { useState, useRef, useEffect } from "react";
import Numpad from "./Numpad";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTournamentStore } from "@/lib/store"; // Quantum Store

interface Hand {
    handNumber: number;
    pointsA: number | null;
    pointsB: number | null;
}

interface ScoreBoardProps {
    initialTeamA?: string[];
    initialTeamB?: string[];
    pairIdA?: number;
    pairIdB?: number;
}

export default function ScoreBoard({
    initialTeamA = ["Nosotros 1", "Nosotros 2"],
    initialTeamB = ["Ellos 1", "Ellos 2"],
    pairIdA,
    pairIdB
}: ScoreBoardProps) {
    const router = useRouter();
    const [teamA, setTeamA] = useState(initialTeamA);
    const [teamB, setTeamB] = useState(initialTeamB);
    const [config, setConfig] = useState({ pairA: pairIdA, pairB: pairIdB });
    const [isSaving, setIsSaving] = useState(false);

    // QUANTUM UPGRADE: Connect to Store
    const { addMatch, tournamentId } = useTournamentStore();

    /**
     * EFFECT: RESTORE SESSION
     * Reads the "activeMatch" from storage to hydrate the names and pair IDs.
     * This allows the page to survive a browser refresh.
     */
    useEffect(() => {
        // Load match config - prioritize sessionStorage for tab isolation
        const matchStr = sessionStorage.getItem("activeMatch") || localStorage.getItem("activeMatch");
        if (matchStr) {
            const match = JSON.parse(matchStr);
            setTeamA([match.scorer, match.myPartner]);
            setTeamB(match.oppNames || initialTeamB);
            setConfig({ pairA: match.myPair, pairB: match.opponentPair });
        }
    }, [initialTeamB]);

    const [hands, setHands] = useState<Hand[]>([
        { handNumber: 1, pointsA: null, pointsB: null },
    ]);
    const [activeCell, setActiveCell] = useState<{ handResultIndex: number, team: 'A' | 'B' } | null>(null);
    const [winner, setWinner] = useState<'A' | 'B' | null>(null);

    // DYNAMIC TOTALS
    const totalA = hands.reduce((acc, h) => acc + (h.pointsA || 0), 0);
    const totalB = hands.reduce((acc, h) => acc + (h.pointsB || 0), 0);
    const targetScore = 100;
    const scrollRef = useRef<HTMLDivElement>(null);

    // WIN CONDITION: 100 Points or more
    const reachedTarget = totalA >= 100 || totalB >= 100;

    const handleFinishGame = () => {
        if (totalA >= 100) setWinner('A');
        else if (totalB >= 100) setWinner('B');
    };

    /**
     * handleSaveAndExit (CRITICAL)
     * Commit the match result to history and exit to lobby.
     * NOW USES: Zustand Store Action
     */
    const handleSaveAndExit = () => {
        if (!winner || isSaving) return;
        setIsSaving(true);

        const currentTId = tournamentId || "legacy"; // Store fallback
        const timestamp = Date.now();

        // Generate a deterministic Match ID to prevent duplicates
        const matchId = `${currentTId}-${config.pairA}-${config.pairB}-${timestamp}`;

        const newRecord = {
            id: matchId, // New unique ID
            tournamentId: currentTId,
            myPair: config.pairA || 0,
            oppPair: config.pairB || 0,
            scoreMy: totalA,
            scoreOpp: totalB,
            oppNames: teamB,
            timestamp: timestamp
        };

        // ACTION: Dispatch to Store
        addMatch(newRecord);

        // CLEANUP: Remove active match so user isn't stuck in "Game Mode"
        localStorage.removeItem("activeMatch");
        sessionStorage.removeItem("activeMatch");

        // REDIRECT: Conscious Navigation using Next.js Router
        router.push('/table-select');
    };

    const handleInput = (num: number) => {
        if (!activeCell || winner) return;
        setHands(prev => {
            const newHands = [...prev];
            if (!newHands[activeCell.handResultIndex]) return prev;
            const hand = { ...newHands[activeCell.handResultIndex] };
            const currentVal = activeCell.team === 'A' ? hand.pointsA : hand.pointsB;
            let nextVal: number;
            if (currentVal === null) nextVal = num;
            else {
                const strVal = currentVal.toString();
                nextVal = parseInt(`${strVal}${num}`);
            }
            if (nextVal > 999) nextVal = 999;
            if (activeCell.team === 'A') hand.pointsA = nextVal;
            else hand.pointsB = nextVal;
            newHands[activeCell.handResultIndex] = hand;
            return newHands;
        });
    };

    const handleDelete = () => {
        if (!activeCell) return;
        setHands(prev => {
            const newHands = [...prev];
            if (!newHands[activeCell.handResultIndex]) return prev;
            const hand = { ...newHands[activeCell.handResultIndex] };
            const currentVal = activeCell.team === 'A' ? hand.pointsA : hand.pointsB;
            if (currentVal === null || currentVal < 10) {
                if (activeCell.team === 'A') hand.pointsA = null;
                else hand.pointsB = null;
            } else {
                const str = currentVal.toString();
                const nextVal = parseInt(str.substring(0, str.length - 1));
                if (activeCell.team === 'A') hand.pointsA = nextVal;
                else hand.pointsB = nextVal;
            }
            newHands[activeCell.handResultIndex] = hand;
            return newHands;
        });
    };

    const handleEnter = () => {
        if (!activeCell) return;
        const currentHand = hands[activeCell.handResultIndex];
        if (currentHand.pointsA !== null || currentHand.pointsB !== null) {
            setActiveCell(null);
            if (activeCell.handResultIndex === hands.length - 1) {
                setTimeout(() => {
                    setHands(prev => [
                        ...prev,
                        { handNumber: prev.length + 1, pointsA: null, pointsB: null }
                    ]);
                }, 300);
            }
        }
    };

    const selectCell = (index: number, team: 'A' | 'B') => {
        setActiveCell({ handResultIndex: index, team });
    };

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [hands, activeCell]);

    return (
        <div className="flex flex-col h-screen max-w-md mx-auto bg-[#4A3B32] text-[#FDFBF7] font-hand overflow-hidden relative shadow-2xl">
            <div className="flex justify-between items-end px-6 pt-6 pb-4 border-b border-white/10 bg-[#4A3B32] z-10 shadow-md">
                <div className="flex flex-col items-center w-1/2 border-r border-white/10">
                    <div className="flex flex-col items-center text-xl font-bold text-[#A5D6A7]">
                        <span>{teamA[0]}</span>
                        <span className="text-xl font-black mt-1 mb-1 text-[#A5D6A7]">&</span>
                        <span>{teamA[1]}</span>
                    </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center">
                    {/* Target Score 100 removed as requested */}
                </div>
                <div className="flex flex-col items-center w-1/2 pl-4">
                    <div className="flex flex-col items-center text-xl font-bold text-[#EF9A9A]">
                        <span>{teamB[0]}</span>
                        <span className="text-xl font-black mt-1 mb-1 text-[#EF9A9A]">&</span>
                        <span>{teamB[1]}</span>
                    </div>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 pb-40">
                <AnimatePresence>
                    {hands.map((hand, index) => (
                        <motion.div key={hand.handNumber} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between relative">
                            <button onClick={() => selectCell(index, 'A')} className={`w-20 h-16 rounded-xl flex items-center justify-center text-3xl font-bold transition-all ${index === activeCell?.handResultIndex && activeCell?.team === 'A' ? "bg-white text-[#4A3B32] ring-4 ring-[#81C784]" : "bg-white/5 hover:bg-white/10"} ${hand.pointsA === null ? "opacity-50" : "opacity-100"}`}>
                                {hand.pointsA !== null ? hand.pointsA : (index === activeCell?.handResultIndex && activeCell?.team === 'A' ? "_" : "")}
                            </button>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs opacity-30">{hand.handNumber}</div>
                            <button onClick={() => selectCell(index, 'B')} className={`w-20 h-16 rounded-xl flex items-center justify-center text-3xl font-bold transition-all ${index === activeCell?.handResultIndex && activeCell?.team === 'B' ? "bg-white text-[#4A3B32] ring-4 ring-[#E57373]" : "bg-white/5 hover:bg-white/10"} ${hand.pointsB === null ? "opacity-50" : "opacity-100"}`}>
                                {hand.pointsB !== null ? hand.pointsB : (index === activeCell?.handResultIndex && activeCell?.team === 'B' ? "_" : "")}
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {reachedTarget && !winner && (
                <div className="bg-orange-500/10 border-t border-orange-500/30 p-4 animate-in slide-in-from-bottom-5 duration-300">
                    <p className="text-orange-300 text-center text-sm font-bold uppercase tracking-wider mb-3">⚠️ Revisar los datos antes de confirmar</p>
                    <button onClick={handleFinishGame} className="w-full py-4 bg-orange-500 text-white text-xl font-bold rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:bg-orange-600 active:scale-[0.98] transition-all">Fin de la Partida</button>
                </div>
            )}

            <div className={`bg-[#3E3129] border-t border-white/10 p-4 flex justify-between items-center z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${reachedTarget && !winner ? 'pb-4' : 'pb-8'}`}>
                <motion.div
                    key={totalA}
                    initial={{ scale: 1.2, color: "#81C784" }}
                    animate={{ scale: 1, color: "#A5D6A7" }}
                    className="text-6xl font-black w-1/2 text-center drop-shadow-[0_0_15px_rgba(165,214,167,0.3)]"
                >
                    {totalA}
                </motion.div>
                <motion.div
                    key={totalB}
                    initial={{ scale: 1.2, color: "#E57373" }}
                    animate={{ scale: 1, color: "#EF9A9A" }}
                    className="text-6xl font-black w-1/2 text-center drop-shadow-[0_0_15px_rgba(239,154,154,0.3)]"
                >
                    {totalB}
                </motion.div>
            </div>

            <AnimatePresence>
                {activeCell && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 bg-[#FDFBF7] p-4 rounded-t-3xl shadow-2xl z-50 text-[#4A3B32]">
                        <div className="text-center mb-4 text-sm font-bold opacity-50 uppercase">Ingresando puntos para {activeCell.team === 'A' ? "NOSOTROS" : "ELLOS"}</div>
                        <Numpad onInput={handleInput} onDelete={handleDelete} onEnter={handleEnter} />
                    </motion.div>
                )}
            </AnimatePresence>

            {winner && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, rotate: -5 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        className="bg-gradient-to-b from-[#5e4b41] to-[#3E3129] border border-[#A5D6A7]/30 p-10 rounded-[3rem] max-w-md w-full text-center shadow-[0_0_80px_rgba(165,214,167,0.15)] relative overflow-hidden"
                    >
                        {/* Decorative glow */}
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#A5D6A7]/10 rounded-full blur-[80px]"></div>
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#EF9A9A]/10 rounded-full blur-[80px]"></div>

                        <motion.div
                            animate={{
                                y: [0, -10, 0],
                                rotate: [0, 5, -5, 0]
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Trophy className="mx-auto text-[#FFD700] mb-6 drop-shadow-[0_0_25px_rgba(255,215,0,0.5)]" size={100} />
                        </motion.div>

                        <h2 className="text-5xl font-black text-white mb-8 tracking-tighter italic">¡VICTORIA!</h2>

                        <div className="flex flex-col gap-4 mb-8">
                            {/* WINNER */}
                            <div className="bg-[#1B5E20]/40 p-4 rounded-2xl border border-[#A5D6A7]/30 shadow-[0_0_30px_rgba(165,214,167,0.2)]">
                                <div className="text-2xl font-black text-[#A5D6A7] mb-1">
                                    {winner === 'A' ? `${teamA[0]} & ${teamA[1]}` : `${teamB[0]} & ${teamB[1]}`}
                                </div>
                                <div className="text-5xl font-black text-white drop-shadow-md">
                                    {winner === 'A' ? totalA : totalB}
                                </div>
                            </div>

                            {/* LOSER */}
                            <div className="bg-[#B71C1C]/40 p-4 rounded-2xl border border-[#EF9A9A]/30">
                                <div className="text-2xl font-black text-[#EF9A9A] mb-1">
                                    {winner === 'A' ? `${teamB[0]} & ${teamB[1]}` : `${teamA[0]} & ${teamA[1]}`}
                                </div>
                                <div className="text-5xl font-black text-white/80 drop-shadow-md">
                                    {winner === 'A' ? totalB : totalA}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveAndExit}
                            disabled={isSaving}
                            className={`
                                w-full py-5 text-2xl font-black rounded-2xl transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95
                                ${isSaving
                                    ? 'bg-white/10 text-white/20'
                                    : 'bg-white text-[#1B5E20] hover:bg-[#A5D6A7] hover:scale-105 shadow-[0_10px_40px_rgba(165,214,167,0.2)]'}
                            `}
                        >
                            {isSaving ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-current"></div>
                            ) : (
                                <Medal size={28} />
                            )}
                            {isSaving ? "REGISTRANDO..." : "FINALIZAR JUEGO"}
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
