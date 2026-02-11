"use client";

/**
 * @file app/setup/page.tsx
 * @description Tournament Configuration Page (Host View).
 * @author Antigravity (Google Deepmind)
 * 
 * MAIN RESPONSIBILITIES:
 * 1. Allow Host to assign players to pairs (1-8).
 * 2. Validate that pairs have exactly 2 players.
 * 3. Enforce Round Robin constraints (minimum 2 pairs).
 * 4. INITIALIZE THE TOURNAMENT:
 *    - Generate unique ID.
 *    - Clear old data.
 *    - Save config to LocalStorage.
 */

import { useState } from "react";
import { OFFICIAL_PLAYERS } from "@/lib/constants";
import { Users, PlayCircle, AlertCircle, ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTournamentStore } from "@/lib/store"; // Quantum Store

export default function SetupPage() {
    const router = useRouter();

    // STATE: Mapping of Player Name -> Pair Number (or empty string if unassigned)
    // Initialized with all OFFICIAL_PLAYERS set to ""
    const [assignments, setAssignments] = useState<Record<string, number | "">>(
        Object.fromEntries(OFFICIAL_PLAYERS.map(p => [p, ""]))
    );

    /**
     * handleAssign
     * Updates the assignment state when a dropdown is changed.
     */
    const handleAssign = (player: string, value: string) => {
        setAssignments(prev => ({
            ...prev,
            [player]: value ? parseInt(value) : ""
        }));
    };

    /**
     * VALIDATION LOGIC
     * transforms the flat assignments map into a structured Pairs object.
     * Record<PairNumber, Array<PlayerNames>>
     */
    const getPairs = () => {
        const pairs: Record<number, string[]> = {};
        Object.entries(assignments).forEach(([player, pairNum]) => {
            if (pairNum !== "") {
                if (!pairs[pairNum]) pairs[pairNum] = [];
                pairs[pairNum].push(player);
            }
        });
        return pairs;
    };

    const pairs = getPairs();
    const activePairs = Object.entries(pairs);
    const totalPlayers = Object.values(assignments).filter(Boolean).length;

    // RULE CHECKS:
    // 1. Pairs must have exactly 2 players.
    const invalidPairs = activePairs.filter(([_, players]) => players.length !== 2);
    // 2. Must have at least 1 valid pair (technically 2 for a match) and even number of players.
    const isValid = activePairs.length > 0 && invalidPairs.length === 0 && totalPlayers % 2 === 0;

    /**
     * handleFinishSetup (CRITICAL)
     * Executed when "Guardar y Comenzar" is clicked.
     * Use this to initialize the "Virgin State" of a new tournament.
     * NOW USES: Zustand Store (Transfiguration of State)
     */
    const handleFinishSetup = () => {
        if (!isValid) return;

        // 1. Generate unique tournament ID (Timestamp based)
        const tId = `pitomate_${Date.now()}`;

        // 2. Quantum Store Initialization
        // "The Store is the single source of truth"
        useTournamentStore.getState().initializeTournament(tId, "Anfitrión", pairs);

        // 3. Fallback Cleanup (Just in case)
        localStorage.removeItem("activeMatch");
        sessionStorage.removeItem("activeMatch");
        // Legacy cleanup
        localStorage.removeItem("match_history");

        console.log("Setup initialized via Store:", tId);
        router.push("/");
    };

    return (
        <div className="min-h-screen bg-[#4A3B32] text-[#FDFBF7] font-hand p-4 pb-20">

            {/* Header */}
            <div className="flex flex-col items-center text-center gap-6 mb-12">
                <a href="/" className="text-[#A5D6A7] flex items-center gap-2 hover:opacity-80 transition self-center">
                    <ArrowLeft size={20} /> Volver
                </a>

                <div>
                    <h1 className="text-4xl font-bold mb-2">Configuración de Jornada</h1>
                    <p className="opacity-60 text-lg">Jornada 1 • Anfitrión: Rudy</p>
                </div>

                <button
                    onClick={handleFinishSetup}
                    disabled={!isValid}
                    className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg
            ${isValid
                            ? 'bg-[#A5D6A7] text-[#1B5E20] hover:scale-105'
                            : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                >
                    <Save size={20} />
                    Guardar y Comenzar
                </button>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left Column: Roster */}
                <div className="bg-black/20 p-8 rounded-3xl backdrop-blur-sm border border-white/5">
                    <div className="flex justify-center items-center gap-3 mb-6">
                        <Users className="text-[#A5D6A7]" size={28} />
                        <h2 className="text-2xl font-bold">Jugadores</h2>
                    </div>
                    <div className="space-y-3">
                        {OFFICIAL_PLAYERS.map((player) => {
                            const assignedNum = assignments[player];
                            return (
                                <div key={player} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${assignedNum ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                    <span className={`text-lg ${assignedNum ? 'font-bold' : 'opacity-60'}`}>
                                        {player}
                                    </span>

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs opacity-30 uppercase tracking-widest mr-2">
                                            {assignedNum ? "Pareja" : "Falta"}
                                        </span>
                                        <select
                                            value={assignedNum}
                                            onChange={(e) => handleAssign(player, e.target.value)}
                                            className="bg-[#FDFBF7] text-[#4A3B32] font-bold text-center w-16 h-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#81C784]"
                                        >
                                            <option value="">-</option>
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                                <option key={num} value={num}>{num}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Column 2: Status & Validation */}
                <div className="space-y-6">
                    <div className="bg-black/20 p-6 rounded-2xl backdrop-blur-sm border border-white/5 min-h-[200px]">
                        <div className="flex justify-center items-center gap-2 mb-6">
                            <Users className="text-[#A5D6A7]" size={28} />
                            <Users className="text-[#A5D6A7]" size={28} />
                            <h2 className="text-2xl font-bold ml-2">Parejas</h2>
                        </div>

                        {activePairs.length === 0 ? (
                            <p className="opacity-40 text-center py-10 italic">
                                Selecciona números para armar las parejas...
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {activePairs.sort((a, b) => Number(a[0]) - Number(b[0])).map(([pairNum, players]) => (
                                    <div key={pairNum} className={`flex justify-between items-center p-3 rounded-lg border ${players.length === 2 ? 'border-[#81C784]/30 bg-[#81C784]/10' : 'border-[#E57373]/30 bg-[#E57373]/10'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold">
                                                {pairNum}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold">
                                                    {players.join(" & ")}
                                                </span>
                                                {players.length !== 2 && (
                                                    <span className="text-xs text-[#E57373]">
                                                        {players.length < 2 ? "Falta jugador" : "Demasiados jugadores"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-black/20 p-6 rounded-2xl backdrop-blur-sm border border-white/5">
                        <div className="flex justify-between text-sm opacity-60 mb-2">
                            <span>Jugadores: {totalPlayers}</span>
                            <span>Parejas: {activePairs.length}</span>
                        </div>

                        {invalidPairs.length > 0 && (
                            <div className="text-[#EF9A9A] bg-[#B71C1C]/20 p-3 rounded-lg text-sm mb-4 flex items-center gap-2">
                                <AlertCircle size={16} />
                                Todas las parejas deben tener exactamente 2 jugadores.
                            </div>
                        )}

                        <button
                            onClick={handleFinishSetup}
                            disabled={!isValid}
                            className={`w-full py-4 text-xl font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all
                ${isValid
                                    ? "bg-[#FDFBF7] text-[#4A3B32] hover:bg-white hover:scale-105"
                                    : "bg-white/5 text-white/20 cursor-not-allowed"}
              `}
                        >
                            <PlayCircle size={28} />
                            Confirmar y Arrancar
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
