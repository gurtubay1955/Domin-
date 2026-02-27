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
import { Users, PlayCircle, AlertCircle, ArrowLeft, Save, Lock, RefreshCw, Dices, CheckCircle2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTournamentStore } from "@/lib/store"; // Quantum Store
import PinGuard from "@/components/PinGuard"; // Guard
import { generateUUID } from "@/lib/utils";
import { getActiveTournamentId, fetchTournamentConfig, deactivateTournament } from "@/lib/tournamentService";

function SetupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentHost = searchParams.get('host') || ""; // User requested empty if not set

    // STATE: Selección de Asistencia (V7.2)
    // Guardamos un Set con los nombres de los jugadores que asistieron a la jornada
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

    // STATE: Parejas generadas por el Motor Aleatorio
    const [finalPairs, setFinalPairs] = useState<Record<string, string[]>>({});
    const [isSorteoComplete, setIsSorteoComplete] = useState(false);

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
     * handleTogglePlayer (V7.2)
     * Marca o desmarca a un jugador como asistente.
     */
    const handleTogglePlayer = (player: string) => {
        setIsSorteoComplete(false); // Resetear sorteo si se cambia la asistencia
        setFinalPairs({});

        setSelectedPlayers(prev => {
            const next = new Set(prev);
            if (next.has(player)) {
                next.delete(player);
            } else {
                next.add(player);
            }
            return next;
        });
    };

    /**
     * Fisher-Yates array shuffle puro
     */
    const shuffleArray = (array: string[]) => {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    };

    /**
     * Motor de Reglas Estocásticas (V7.2)
     */
    const handleSorteoAleatorio = () => {
        if (!isValidForSorteo) return;
        setIsSorteoComplete(false);

        const players = Array.from(selectedPlayers);
        let finalPairsMap: Record<string, string[]> = {};
        let resultValid = false;
        let intentos = 0;

        // Bucle de Motor Estocástico con Fallback (Brute-Force Reroll)
        while (!resultValid && intentos < 1000) {
            intentos++;
            finalPairsMap = {};
            let pairCounter = 1;

            let pool = [...players];

            // ==========================================
            // REGLA 1 (Dúo Dinámico): "Alex" y "Rodrigo Jr"
            // Si ambos vinieron, son pareja obligatoria.
            // ==========================================
            const hasAlex = pool.includes("Alex");
            const hasRodriJr = pool.includes("Rodrigo Jr");
            const hasRodri = pool.includes("Rodrigo");

            if (hasAlex && hasRodriJr) {
                // Inyectamos a fuerza en la Mesa 1
                finalPairsMap[pairCounter.toString()] = ["Alex", "Rodrigo Jr"];
                pairCounter++;
                // Los sacamos de la tómbola
                pool = pool.filter(p => p !== "Alex" && p !== "Rodrigo Jr");
            }

            // ==========================================
            // SORTEO GENERAL
            // ==========================================
            pool = shuffleArray(pool);

            // Armamos el resto de las parejas y las guardamos temporalmente
            const tempPairsList: string[][] = [];
            for (let i = 0; i < pool.length; i += 2) {
                tempPairsList.push([pool[i], pool[i + 1]]);
            }

            // ==========================================
            // REGLA 2 (Filtro Profesional): "Alex" vs "Rodrigo"
            // Solo aplica si Rodrigo Jr no asistió.
            // Si cayeron juntos en una pareja temporal, abortamos.
            // ==========================================
            let regla2Rota = false;

            if (!hasRodriJr && hasAlex && hasRodri) {
                // Buscamos si en alguna de las parejitas temporales están ambos amontonados
                for (const pair of tempPairsList) {
                    if (pair.includes("Alex") && pair.includes("Rodrigo")) {
                        regla2Rota = true;
                        break;
                    }
                }
            }

            // Validación de Intento
            if (regla2Rota) {
                // El Sorteo es Nulo, tiramos los boletos y repetimos el While (intentos++)
                continue;
            } else {
                // Sorteo Exitoso, asignamos los tickets
                tempPairsList.forEach(pair => {
                    finalPairsMap[pairCounter.toString()] = pair;
                    pairCounter++;
                });
                resultValid = true; // Rompe el While
            }
        }

        if (!resultValid) {
            alert("⚠️ Error del Motor: No se pudo generar una combinación que cumpla todas las reglas después de 1000 intentos.");
            return;
        }

        console.log(`✅ Sorteo exitoso tras ${intentos} iteraciones invisibles.`);
        setFinalPairs(finalPairsMap);
        setIsSorteoComplete(true);
    };

    // VALIDATION LOGIC (V7.2)
    const activePlayersCount = selectedPlayers.size;
    const isValidForSorteo = activePlayersCount >= 4 && activePlayersCount % 2 === 0;
    const isValidForSave = isSorteoComplete && Object.keys(finalPairs).length > 0;

    const [isSavingSetup, setIsSavingSetup] = useState(false);

    /**
     * handleFinishSetup (CRITICAL)
     * Executed when "Guardar y Comenzar" is clicked.
     * Use this to initialize the "Virgin State" of a new tournament.
     * NOW USES: Zustand Store (Transfiguration of State)
     */
    const handleFinishSetup = async () => {
        if (!isValidForSave || isSavingSetup) return;
        setIsSavingSetup(true);

        // 1. Generate unique tournament ID (UUID for Supabase)
        const tId = generateUUID();
        const finalHost = currentHost || "Anfitrión"; // Fallback

        try {
            // 2. 🟢 V6.2: STRICT SYNCHRONOUS WAIT FOR DATABASE (Race Condition Fix)
            const { createTournament, setActiveTournament } = await import('@/lib/tournamentService');
            // Usamos las parejas finales sorteadas 'finalPairs'
            const res = await createTournament(tId, finalHost, finalPairs);

            if (!res.success || !res.pairIds) {
                alert("⚠️ Error al crear torneo en la nube: " + (res.error || "Missing UUIDs"));
                setIsSavingSetup(false);
                return;
            }

            // 3. Quantum Store Initialization (Local, with GUARANTEED pairUuidMap)
            useTournamentStore.getState().initializeTournament(tId, finalHost, finalPairs, [], res.pairIds);

            // 4. V4 MULTIPLAYER SYNC: Publish Global Signal
            // This wakes up all other clients
            const activeRes = await setActiveTournament(tId);
            if (!activeRes.success) {
                alert("⚠️ Error al publicar Jornada. Revisa conexión.");
            }

            // 5. Fallback Cleanup (Just in case)
            localStorage.removeItem("activeMatch");
            sessionStorage.removeItem("activeMatch");
            localStorage.removeItem("match_history");

            console.log("✅ Setup initialized via Store & Cloud (Synchronously):", tId);
            router.push("/");
        } catch (error) {
            console.error("Critical Setup Error:", error);
            setIsSavingSetup(false);
        }
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

                        {/* Left Column: Asistencia (V7.2) */}
                        <div className="bg-black/20 p-8 rounded-3xl backdrop-blur-sm border border-white/5">
                            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                                <div className="flex items-center gap-3">
                                    <Users className="text-[#A5D6A7]" size={28} />
                                    <h2 className="text-3xl font-bold">Asistencia</h2>
                                </div>
                                <div className="bg-[#A5D6A7]/20 border border-[#A5D6A7]/40 px-4 py-2 rounded-xl">
                                    <span className="text-xl font-bold text-[#A5D6A7]">{activePlayersCount} Jugadores</span>
                                </div>
                            </div>

                            <p className="text-white/50 text-xl font-bold uppercase tracking-widest mb-4">Marca a los presentes</p>

                            <div className="grid grid-cols-2 gap-3">
                                {OFFICIAL_PLAYERS.map((player) => {
                                    const isAssisting = selectedPlayers.has(player);
                                    return (
                                        <button
                                            key={player}
                                            onClick={() => handleTogglePlayer(player)}
                                            className={`flex items-center justify-between p-4 rounded-xl transition-all border-2 text-left
                                                ${isAssisting
                                                    ? 'bg-[#A5D6A7]/20 border-[#A5D6A7] text-white scale-[1.02] shadow-[0_0_15px_rgba(165,214,167,0.2)]'
                                                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}
                                            `}
                                        >
                                            <span className={`text-2xl pt-1 truncate ${isAssisting ? 'font-black' : 'font-medium'}`}>
                                                {player}
                                            </span>

                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                                                ${isAssisting ? 'bg-[#A5D6A7] text-[#1B5E20]' : 'bg-black/20 text-white/10'}`}>
                                                {isAssisting && <CheckCircle2 size={20} strokeWidth={3} />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Alerta de Imparidad */}
                            {!isValidForSorteo && activePlayersCount > 0 && (
                                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center gap-3 text-red-300">
                                    <AlertCircle size={24} />
                                    <span className="text-xl font-bold">El número de asistentes debe ser par.</span>
                                </div>
                            )}

                            {/* Botón de Sorteo (Habilitado solo si es par) */}
                            <button
                                onClick={handleSorteoAleatorio}
                                disabled={!isValidForSorteo}
                                className={`w-full mt-6 py-6 rounded-2xl font-black text-3xl shadow-xl flex items-center justify-center gap-3 transition-transform
                                    ${isValidForSorteo
                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:scale-[1.02] border border-blue-400/50'
                                        : 'bg-white/5 text-white/20 cursor-not-allowed'}
                                `}
                            >
                                <Dices size={32} />
                                {isSorteoComplete ? 'Volver a Sortear Parejas' : 'Sortear Parejas Estocásticamente'}
                            </button>
                        </div>

                        {/* Column 2: Status & Validation (V7.2 Sorteo Display) */}
                        <div className="space-y-6">
                            <div className="bg-black/20 p-6 rounded-2xl backdrop-blur-sm border border-white/5 min-h-[500px] flex flex-col">
                                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                                    <div className="bg-yellow-500/20 p-2 rounded-xl text-yellow-400">
                                        <Dices size={24} />
                                    </div>
                                    <h2 className="text-3xl font-bold">Resultado del Sorteo</h2>
                                </div>

                                {!isSorteoComplete ? (
                                    <div className="flex-1 flex flex-col items-center justify-center opacity-40 text-center py-10">
                                        <Dices size={64} className="mb-4 text-white/20" />
                                        <p className="italic text-2xl font-medium">
                                            Marca a los asistentes y presiona<br />"Sortear Parejas Estocásticamente"
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 flex-1">
                                        {Object.entries(finalPairs).map(([pairNum, players]) => (
                                            <div key={pairNum} className="flex justify-between items-center p-5 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/10 shadow-lg">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center font-black text-3xl text-yellow-950 shadow-inner">
                                                        {pairNum}
                                                    </div>
                                                    <div className="flex flex-col text-left">
                                                        <span className="text-sm font-bold opacity-60 uppercase tracking-widest text-yellow-200">Pareja #{pairNum}</span>
                                                        <span className="font-black text-3xl text-white pt-1">
                                                            {players.join(" y ")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-black/20 p-6 rounded-3xl backdrop-blur-sm border border-white/5">
                                <PinGuard
                                    onVerify={handleFinishSetup}
                                    title="Guardar Jornada"
                                    description="¿Confirmar el sorteo e iniciar el Torneo?"
                                >
                                    <button
                                        disabled={!isValidForSave}
                                        className={`w-full py-6 text-3xl font-black rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] flex items-center justify-center gap-3 transition-transform duration-300
                                            ${isValidForSave
                                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:scale-[1.02] border border-green-400/50"
                                                : "bg-white/5 text-white/10 cursor-not-allowed"}
                                        `}
                                    >
                                        <Save size={32} />
                                        Comenzar Torneo
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
