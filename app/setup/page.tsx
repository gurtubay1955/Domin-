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

import { useState, Suspense, useEffect } from "react";
import { OFFICIAL_PLAYERS } from "@/lib/constants";
import { Users, PlayCircle, AlertCircle, ArrowLeft, Save, Lock, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTournamentStore } from "@/lib/store"; // Quantum Store
import PinGuard from "@/components/PinGuard"; // Guard
import { generateUUID } from "@/lib/utils";
import { getActiveTournamentId, fetchTournamentConfig, deactivateTournament } from "@/lib/tournamentService";

function SetupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentHost = searchParams.get('host') || ""; // User requested empty if not set

    // STATE: Mapping of Player Name -> Pair Number (or empty string if unassigned)
    // Initialized with all OFFICIAL_PLAYERS set to ""
    const [assignments, setAssignments] = useState<Record<string, number | "">>(
        Object.fromEntries(OFFICIAL_PLAYERS.map(p => [p, ""]))
    );

    // 🛡️ HIGHLANDER PROTOCOL SCHEMA
    const [blockingTournament, setBlockingTournament] = useState<{ id: string, host: string } | null>(null);
    const [isLoadingCheck, setIsLoadingCheck] = useState(true);

    // EFFECT: Check for existing Active Tournament (The "One Host" Rule)
    useEffect(() => {
        const checkHighlander = async () => {
            setIsLoadingCheck(true);
            const { success, activeId } = await getActiveTournamentId();

            if (success && activeId) {
                // Determine who is hosting it
                const { success: cSuccess, config } = await fetchTournamentConfig(activeId);
                if (cSuccess && config) {
                    console.warn(`🛑 SETUP BLOCKED: Tournament ${activeId} is already active by ${config.hostName}`);
                    setBlockingTournament({ id: activeId, host: config.hostName });
                }
            }
            setIsLoadingCheck(false);
        };
        checkHighlander();
    }, []);

    const handleForceJoin = () => {
        router.push("/");
    };

    const handleNuclearReset = async () => {
        // Allow the user to "Kill" the existing tournament if they really want to start over
        if (confirm("⚠️ ¿Estás SEGURO? Esto borrará el torneo activo para TODOS los dispositivos. Solo hazlo si el torneo anterior ya terminó.")) {
            await deactivateTournament();
            setBlockingTournament(null); // Unblock
            window.location.reload();
        }
    };


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

        // 1. Generate unique tournament ID (UUID for Supabase)
        const tId = generateUUID();

        // 2. Quantum Store Initialization (Local)
        // This is immediate for the Host
        const finalHost = currentHost || "Anfitrión"; // Fallback
        useTournamentStore.getState().initializeTournament(tId, finalHost, pairs);

        // 3. V4 MULTIPLAYER SYNC: Publish Global Signal
        // This wakes up all other clients
        import('@/lib/tournamentService').then(({ setActiveTournament }) => {
            setActiveTournament(tId).then(res => {
                if (!res.success) alert("⚠️ Error al publicar Jornada. Revisa conexión.");
            });
        });

        // 4. Fallback Cleanup (Just in case)
        localStorage.removeItem("activeMatch");
        sessionStorage.removeItem("activeMatch");
        // Legacy cleanup
        localStorage.removeItem("match_history");

        console.log("Setup initialized via Store & Cloud:", tId);
        router.push("/");
    };

    return (
        <div className="min-h-screen bg-[#4A3B32] text-[#FDFBF7] font-hand p-4 pb-20">

            {/* Header */}
            <div className="flex flex-col items-center text-center gap-6 mb-12">
                <a href="/" className="text-[#A5D6A7] flex items-center gap-2 hover:opacity-80 transition self-center text-2xl font-bold">
                    <ArrowLeft size={24} /> Volver
                </a>

                <div>
                    <h1 className="text-5xl font-bold mb-2 text-white">Configuración de Jornada</h1>
                    <p className="opacity-90 text-3xl text-white">Jornada 1 • Anfitrión: <span className="font-bold text-[#A5D6A7]">{currentHost || "No Asignado"}</span></p>
                </div>


            </div>



            {/* 🛡️ HIGHLANDER BLOCKING UI */}
            {
                isLoadingCheck ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#A5D6A7]"></div>
                    </div>
                ) : blockingTournament ? (
                    <div className="max-w-3xl mx-auto bg-red-900/40 border border-red-500/30 p-8 rounded-3xl backdrop-blur-md text-center shadow-2xl">
                        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Lock className="text-red-400" size={48} />
                        </div>
                        <h2 className="text-4xl font-black text-white mb-4">ACCESO BLOQUEADO</h2>
                        <p className="text-2xl text-red-200 mb-8 max-w-xl mx-auto">
                            Ya existe una Jornada Activa organizada por <span className="text-white font-bold underline decoration-red-400">{blockingTournament.host}</span>.
                        </p>
                        <p className="text-xl text-white/60 mb-8">
                            No se permiten dos torneos simultáneos ("Cerebro Dividido").
                        </p>

                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            <button
                                onClick={handleForceJoin}
                                className="bg-[#A5D6A7] text-[#1B5E20] py-4 px-8 rounded-xl font-bold text-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                <PlayCircle size={24} />
                                Unirse al Torneo de {blockingTournament.host}
                            </button>

                            <button
                                onClick={handleNuclearReset}
                                className="bg-white/5 text-white/40 py-4 px-8 rounded-xl font-bold text-lg hover:bg-red-500/20 hover:text-red-200 transition-all border border-white/5 flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={20} />
                                Soy {blockingTournament.host} y quiero Reiniciar
                            </button>
                        </div>
                    </div>
                ) : (
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
                                        <div key={player} className={`flex items-center justify-between p-4 rounded-xl transition-colors ${assignedNum ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                            <span className={`text-2xl ${assignedNum ? 'font-bold text-white' : 'opacity-60'}`}>
                                                {player}
                                            </span>

                                            <div className="flex items-center gap-3">
                                                <span className="text-xl font-bold opacity-80 uppercase tracking-widest mr-2 text-white/60">
                                                    {assignedNum ? "Pareja" : "Falta"}
                                                </span>
                                                <select
                                                    value={assignedNum}
                                                    onChange={(e) => handleAssign(player, e.target.value)}
                                                    className="bg-[#FDFBF7] text-[#4A3B32] font-bold text-2xl text-center w-20 h-12 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#81C784]"
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
                                    <p className="opacity-40 text-center py-10 italic text-xl">
                                        Selecciona números para armar las parejas...
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {activePairs.sort((a, b) => Number(a[0]) - Number(b[0])).map(([pairNum, players]) => (
                                            <div key={pairNum} className={`flex justify-between items-center p-4 rounded-xl border-2 ${players.length === 2 ? 'border-[#81C784]/30 bg-[#81C784]/10' : 'border-[#E57373]/30 bg-[#E57373]/10'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl">
                                                        {pairNum}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-2xl text-white">
                                                            {players.join(" & ")}
                                                        </span>
                                                        {players.length !== 2 && (
                                                            <span className="text-xl font-bold text-[#E57373]">
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
                                <div className="flex justify-between text-2xl font-bold text-white mb-3 px-2">
                                    <span>Jugadores: {totalPlayers}</span>
                                    <span>Parejas: {activePairs.length}</span>
                                </div>

                                {invalidPairs.length > 0 && (
                                    <div className="text-[#EF9A9A] bg-[#B71C1C]/20 p-3 rounded-lg text-xl mb-4 flex items-center gap-2 font-bold">
                                        <AlertCircle size={24} />
                                        Todos deben tener pareja.
                                    </div>
                                )}

                                <PinGuard
                                    onVerify={handleFinishSetup}
                                    title="Guardar Jornada"
                                    description="¿Confirmar configuración? Esto sobreescribirá la jornada anterior."
                                >
                                    <button
                                        disabled={!isValid}
                                        className={`w-full py-5 text-2xl font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all
                    ${isValid
                                                ? "bg-[#A5D6A7] text-[#1B5E20] hover:bg-[#81C784] hover:scale-105"
                                                : "bg-white/5 text-white/20 cursor-not-allowed"}
                  `}
                                    >
                                        <Save size={32} />
                                        Guardar y Comenzar
                                    </button>
                                </PinGuard>
                            </div>
                        </div>

                    </div>
                )
            }
        </div>
    );
}

export default function SetupPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#4A3B32] flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#A5D6A7]"></div>
            </div>
        }>
            <SetupContent />
        </Suspense>
    );
}
