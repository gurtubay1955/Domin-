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
import { playClick, playVictory, playZapatero } from "@/lib/soundService";

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
    const [hands, setHands] = useState<Hand[]>([
        { handNumber: 1, pointsA: null, pointsB: null },
    ]);
    const [activeCell, setActiveCell] = useState<{ handResultIndex: number, team: 'A' | 'B' } | null>(null);
    const [winner, setWinner] = useState<'A' | 'B' | null>(null);
    const [isInitialized, setIsInitialized] = useState(false); // GUARD: Prevent auto-save before restore

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

    // EFFECT: Play victory sounds
    useEffect(() => {
        if (winner) {
            playVictory();
            const loserScore = winner === 'A' ? totalB : totalA;
            if (loserScore === 0) {
                playZapatero('double');
            } else if (loserScore <= 50) {
                playZapatero('single');
            }
        }
    }, [winner, totalA, totalB]);

    /**
     * EFFECT: RESTORE SESSION & HANDS
     * Reads the "activeMatch" from storage to hydrate the names and pair IDs.
     * Also restores "activeMatch_hands" if valid.
     */
    useEffect(() => {
        // 1. Restore Match Config
        const matchStr = sessionStorage.getItem("activeMatch") || localStorage.getItem("activeMatch");
        if (matchStr) {
            try {
                const match = JSON.parse(matchStr);
                setTeamA([match.scorer, match.myPartner]);
                setTeamB(match.oppNames || initialTeamB);
                setConfig({ pairA: match.myPair, pairB: match.opponentPair });

                // 2. Restore Hands (Magic Reconnect V6.4 vs Local)
                const savedHandsStr = sessionStorage.getItem("activeMatch_hands");
                if (savedHandsStr) {
                    const savedData = JSON.parse(savedHandsStr);
                    // Use loose equality (==) to handle string/number mismatch
                    if (savedData.pairA == match.myPair && savedData.pairB == match.opponentPair) {
                        console.log("♻️ Restoring saved hands:", savedData.hands);
                        if (savedData.hands && savedData.hands.length > 0) {
                            setHands(savedData.hands);
                            setIsInitialized(true); // MARK AS READY TO SAVE
                            return; // Terminamos, teníamos datos locales
                        }
                    }
                }

                // 3. MAGIC RECONNECT HIDRATION (No local data, try Cloud)
                // If rodolfo cleared cache or used a different browser
                const tId = useTournamentStore.getState().tournamentId;
                if (tId) {
                    import('@/lib/tournamentService').then(async ({ checkActiveMatchForPair }) => {
                        const res = await checkActiveMatchForPair(tId, match.myPair);
                        if (res.success && res.hasActiveMatch && res.matchData) {
                            console.log("🪄 MAGIC RECONNECT: Hydrating from Cloud:", res.matchData);
                            const isPairA = res.matchData.pair_a === match.myPair;
                            const remoteScoreMy = isPairA ? res.matchData.score_a : res.matchData.score_b;
                            const remoteScoreOpp = isPairA ? res.matchData.score_b : res.matchData.score_a;

                            // Si la nube tiene más de 0 puntos, reconstruimos Hand 1 como "Acumulado"
                            if (remoteScoreMy > 0 || remoteScoreOpp > 0) {
                                setHands([{
                                    handNumber: 1,
                                    pointsA: remoteScoreMy,
                                    pointsB: remoteScoreOpp
                                }]);
                            }
                        }
                        setIsInitialized(true);
                    });
                } else {
                    setIsInitialized(true);
                }

            } catch (e) {
                console.error("Failed to restore match/hands", e);
                setIsInitialized(true);
            }
        } else {
            setIsInitialized(true);
        }
    }, []); // Run ONCE on mount, independent of props

    // EFFECT: AUTO-SAVE HANDS & LIVE BROADCAST
    useEffect(() => {
        if (!isInitialized) return; // WAIT FOR RESTORE

        if (config.pairA && config.pairB) {
            // 1. Local Persistence
            const dataToSave = {
                pairA: config.pairA,
                pairB: config.pairB,
                hands: hands
            };
            sessionStorage.setItem("activeMatch_hands", JSON.stringify(dataToSave));

            // 2. Cloud Broadcast (Live Progress) - INSTANT "Texas Hold'em" Style
            // Frequency: Human input speed (max 1-2 ops/sec), safe for Supabase.
            if (tournamentId) {
                console.log(`📡 BROADCAST: ${config.pairA} vs ${config.pairB} | ${totalA}-${totalB} (Hand ${hands.length})`);
                import('@/lib/tournamentService').then(({ updateLiveMatch }) => {
                    updateLiveMatch(
                        tournamentId,
                        config.pairA!,
                        config.pairB!,
                        totalA,
                        totalB,
                        hands.length
                    );
                });
            }
        }
    }, [hands, config, isInitialized, tournamentId, totalA, totalB]);

    const handleSaveAndExit = async () => {
        if (!winner || isSaving) return;
        playClick(); // Feedback for action
        setIsSaving(true);

        const currentTId = tournamentId || "legacy"; // Store fallback
        const timestamp = Date.now();

        // 🟢 V6.1.7: SSOT (Single Source of Truth)
        // Let the backend generate the real UUID so we don't duplicate on realtime sync
        const newRecord = {
            id: "", // Will be assigned by Supabase
            tournamentId: currentTId,
            myPair: config.pairA || 0,
            oppPair: config.pairB || 0,
            scoreMy: totalA,
            scoreOpp: totalB,
            oppNames: teamB,
            timestamp: timestamp,
            // 📊 STATS & LIVE UPDATE
            handsMy: hands.filter(h => (h.pointsA || 0) > (h.pointsB || 0)).length,
            handsOpp: hands.filter(h => (h.pointsB || 0) > (h.pointsA || 0)).length,
            isZapatero: (() => {
                const loserScore = winner === 'A' ? totalB : totalA;
                if (loserScore === 0) return 'double';
                if (loserScore <= 50) return 'single';
                return 'none';
            })() as 'double' | 'single' | 'none'
        };

        // ACTION: Dispatch ONLY to DB, wait for it
        const { recordMatch } = await import('@/lib/tournamentService');
        const res = await recordMatch(newRecord);

        if (!res.success) {
            console.error("❌ FAILED to record match in DB:", res.error);
            // ⚠️ Fallback of last resort if total offline
            addMatch({ ...newRecord, id: `${currentTId}-${config.pairA}-${config.pairB}-${timestamp}` });
        } else {
            console.log("✅ Match perfectly recorded in Cloud.");
        }

        // CLEANUP: Remove active match so user isn't stuck in "Game Mode"
        localStorage.removeItem("activeMatch");
        sessionStorage.removeItem("activeMatch");
        sessionStorage.removeItem("activeMatch_hands"); // Clear saved hands

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
        <div className="flex flex-col h-[100dvh] w-full md:max-w-2xl mx-auto bg-[#4A3B32] text-[#FDFBF7] font-hand overflow-hidden relative shadow-2xl">
            <div className="flex justify-between items-center px-4 py-0.5 border-b border-white/10 bg-[#4A3B32] z-30 shadow-md sticky top-0">
                <div className="flex flex-col items-center w-1/2 border-r border-white/10">
                    <div className="flex flex-col items-center text-base font-bold text-[#A5D6A7] whitespace-nowrap leading-[0.7] gap-0">
                        <span className="text-2xl">{teamA[0]}</span>
                        <span className="text-2xl">{teamA[1]}</span>
                    </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center">
                    {/* Target Score 100 removed as requested */}
                </div>
                <div className="flex flex-col items-center w-1/2 pl-4">
                    <div className="flex flex-col items-center text-base font-bold text-[#EF9A9A] whitespace-nowrap leading-[0.7] gap-0">
                        <span className="text-2xl">{teamB[0]}</span>
                        <span className="text-2xl">{teamB[1]}</span>
                    </div>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 pb-40">
                <AnimatePresence>
                    {hands.map((hand, index) => (
                        <motion.div key={hand.handNumber} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between relative">
                            <button onClick={() => selectCell(index, 'A')} className={`w-[45%] h-14 rounded-xl flex items-center justify-center text-3xl font-bold transition-all border-2 ${index === activeCell?.handResultIndex && activeCell?.team === 'A' ? "bg-white text-[#4A3B32] border-[#81C784] ring-4 ring-[#81C784]/50 z-10 scale-105" : "bg-white/10 border-white/5 hover:bg-white/20"} ${hand.pointsA === null ? "opacity-100" : "opacity-100"}`}>
                                {hand.pointsA !== null ? hand.pointsA : (index === activeCell?.handResultIndex && activeCell?.team === 'A' ? "_" : "")}
                            </button>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xl opacity-50 font-bold">{hand.handNumber}</div>
                            <button onClick={() => selectCell(index, 'B')} className={`w-[45%] h-14 rounded-xl flex items-center justify-center text-3xl font-bold transition-all border-2 ${index === activeCell?.handResultIndex && activeCell?.team === 'B' ? "bg-white text-[#4A3B32] border-[#E57373] ring-4 ring-[#E57373]/50 z-10 scale-105" : "bg-white/10 border-white/5 hover:bg-white/20"} ${hand.pointsB === null ? "opacity-100" : "opacity-100"}`}>
                                {hand.pointsB !== null ? hand.pointsB : (index === activeCell?.handResultIndex && activeCell?.team === 'B' ? "_" : "")}
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {reachedTarget && !winner && (
                <div className="bg-orange-500/10 border-t border-orange-500/30 p-4 animate-in slide-in-from-bottom-5 duration-300">
                    <p className="text-orange-300 text-center text-xl font-bold uppercase tracking-wider mb-3">⚠️ Revisar los datos antes de confirmar</p>
                    <button onClick={handleFinishGame} className="w-full py-4 bg-orange-500 text-white text-2xl font-bold rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:bg-orange-600 active:scale-[0.98] transition-all">Fin de la Partida</button>
                </div>
            )}

            <div className={`bg-[#3E3129] border-t border-white/10 p-4 pb-8 flex justify-between items-center z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]`}>
                <motion.div
                    key={`score-a-${totalA}`} // Prefix to ensure unique key
                    initial={{ scale: 1.2, color: "#81C784" }}
                    animate={{ scale: 1, color: "#A5D6A7" }}
                    className="text-6xl font-black w-1/2 text-center drop-shadow-[0_0_15px_rgba(165,214,167,0.3)]"
                >
                    {totalA}
                </motion.div>
                <motion.div
                    key={`score-b-${totalB}`} // Unique Key
                    initial={{ scale: 1.2, color: "#E57373" }}
                    animate={{ scale: 1, color: "#EF9A9A" }}
                    className="text-6xl font-black w-1/2 text-center drop-shadow-[0_0_15px_rgba(239,154,154,0.3)]"
                >
                    {totalB}
                </motion.div>
            </div>

            <AnimatePresence>
                {activeCell && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 bg-[#FDFBF7] p-4 pt-6 pb-16 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-50 text-[#4A3B32]">
                        <div className="text-center mb-4 text-xl font-black opacity-40 uppercase tracking-widest">Ingresando puntos para {activeCell.team === 'A' ? "NOSOTROS" : "ELLOS"}</div>
                        <Numpad onInput={handleInput} onDelete={handleDelete} onEnter={handleEnter} />
                    </motion.div>
                )}
            </AnimatePresence>

            {winner && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, rotate: -5 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        className="bg-gradient-to-b from-[#5e4b41] to-[#3E3129] border border-[#A5D6A7]/30 p-8 rounded-[3rem] max-w-lg w-full text-center shadow-[0_0_80px_rgba(165,214,167,0.15)] relative overflow-hidden"
                    >
                        {/* Decorative glow */}
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#A5D6A7]/10 rounded-full blur-[80px]"></div>
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#EF9A9A]/10 rounded-full blur-[80px]"></div>

                        {/* ZAPATERO LOGIC CALCULATION */}
                        {(() => {
                            const loserScore = winner === 'A' ? totalB : totalA;
                            let zapateroType: 'double' | 'single' | 'none' = 'none';

                            if (loserScore === 0) zapateroType = 'double';
                            else if (loserScore <= 50) zapateroType = 'single';

                            return (
                                <>
                                    <div className="flex justify-center items-end gap-12 mb-8 relative h-48">
                                        {/* SINGLE ZAPATO */}
                                        {zapateroType === 'single' && (
                                            <motion.div
                                                className="flex flex-col items-center"
                                                animate={{ y: [0, -10, 0] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src="/zapato_sencillo.png"
                                                    alt="Zapato Sencillo"
                                                    className="w-48 h-auto drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]"
                                                />
                                            </motion.div>
                                        )}

                                        {/* DOUBLE ZAPATO - Uses the dedicated double shoe image */}
                                        {zapateroType === 'double' && (
                                            <motion.div
                                                className="flex flex-col items-center"
                                                animate={{ y: [0, -10, 0] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src="/zapato_doble.png"
                                                    alt="Zapato Doble"
                                                    className="w-64 h-auto drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]"
                                                />
                                            </motion.div>
                                        )}

                                        {/* TROPHY CENTER - Always visible but separated */}
                                        <motion.div
                                            animate={{
                                                y: [0, -10, 0],
                                                rotate: [0, 5, -5, 0]
                                            }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                        >
                                            <Trophy className="text-[#FFD700] drop-shadow-[0_0_25px_rgba(255,215,0,0.5)]" size={120} />
                                        </motion.div>
                                    </div>

                                    <h2 className={`text-5xl font-black mb-8 tracking-tighter italic ${zapateroType !== 'none' ? "text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]" : "text-white"}`}>
                                        {zapateroType !== 'none' ? "¡ZAPATO!" : "¡VICTORIA!"}
                                    </h2>
                                </>
                            );
                        })()}

                        <div className="flex flex-col gap-4 mb-8">
                            {/* WINNER */}
                            <div className="bg-[#1B5E20]/40 p-4 rounded-2xl border border-[#A5D6A7]/30 shadow-[0_0_30px_rgba(165,214,167,0.2)]">
                                <div className="text-4xl font-black text-[#A5D6A7] mb-1">
                                    {winner === 'A' ? `${teamA[0]} & ${teamA[1]}` : `${teamB[0]} & ${teamB[1]}`}
                                </div>
                                <div className="text-6xl font-black text-white drop-shadow-md">
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
                                    w-full py-5 text-4xl font-black rounded-2xl transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95
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
