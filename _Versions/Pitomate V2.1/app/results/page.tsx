"use client";

/**
 * @file app/results/page.tsx
 * @description The "Final Standings" page.
 * @author Antigravity (Google Deepmind)
 * 
 * PHSAE 3 UPDATES:
 * - "New Tournament" button to reset store.
 * - Clearer Winner highlight.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Medal, ArrowLeft, Save, ShieldCheck, RefreshCw } from "lucide-react";
import { archiveTournament } from "@/lib/tournamentService";
import { useTournamentStore } from "@/lib/store"; // Quantum Store

// --- Types ---
interface TeamStats {
    pairId: number;
    names: string[];
    matchesPlayed: number;
    wins: number;
    losses: number;
    pointsScored: number;
    pointsAllowed: number;
    pointDiff: number;
}

export default function ResultsPage() {
    const router = useRouter();
    const [stats, setStats] = useState<TeamStats[]>([]);
    const [isArchiving, setIsArchiving] = useState(false);
    const [archivedSuccess, setArchivedSuccess] = useState(false);

    // QUANTUM UPGRADE: Connect to Store
    const {
        tournamentId,
        hostName,
        pairs,
        matchHistory,
        isSetupComplete,
        clearTournament // IMPORTED ACTION
    } = useTournamentStore();

    useEffect(() => {
        // 0. GUARD: Ensure tournament is configured
        if (!isSetupComplete) {
            router.push("/");
            return;
        }

        // 1. CALCULATE STATS
        const tempStats: Record<number, TeamStats> = {};

        // Init stats for all pairs from the store
        Object.entries(pairs).forEach(([idStr, names]) => {
            const id = parseInt(idStr);
            tempStats[id] = {
                pairId: id,
                names: names,
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                pointsScored: 0,
                pointsAllowed: 0,
                pointDiff: 0
            };
        });

        // Process history
        matchHistory.forEach(match => {
            const pairA = match.myPair;
            const pairB = match.oppPair;

            if (!tempStats[pairA] || !tempStats[pairB]) return;

            // Stats Pair A
            tempStats[pairA].matchesPlayed++;
            tempStats[pairA].pointsScored += match.scoreMy;
            tempStats[pairA].pointsAllowed += match.scoreOpp;
            if (match.scoreMy > match.scoreOpp) tempStats[pairA].wins++;
            else tempStats[pairA].losses++;

            // Stats Pair B
            tempStats[pairB].matchesPlayed++;
            tempStats[pairB].pointsScored += match.scoreOpp;
            tempStats[pairB].pointsAllowed += match.scoreMy;
            if (match.scoreOpp > match.scoreMy) tempStats[pairB].wins++;
            else tempStats[pairB].losses++;
        });

        // Calculate Diff & Sort
        const sorted = Object.values(tempStats).map(s => ({
            ...s,
            pointDiff: s.pointsScored - s.pointsAllowed
        })).sort((a, b) => {
            // Priority 1: Wins
            if (b.wins !== a.wins) return b.wins - a.wins;
            // Priority 2: Point Differential
            if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
            // Priority 3: Total Points Scored
            return b.pointsScored - a.pointsScored;
        });

        setStats(sorted);

    }, [pairs, matchHistory, isSetupComplete, router]);

    const handleArchive = async () => {
        if (isArchiving || archivedSuccess) return;
        setIsArchiving(true);

        const payload = {
            tournamentId: tournamentId || `legacy_${Date.now()}`,
            host: hostName || "Unknown Host",
            pairs: pairs,
            stats: stats,
            history: matchHistory
        };

        const result = await archiveTournament(payload);

        if (result.success) {
            setArchivedSuccess(true);
            alert("✅ Torneo archivado correctamente en la nube.");
        } else {
            alert("❌ Error al archivar: " + result.error);
        }
        setIsArchiving(false);
    };

    /**
     * handleNewTournament
     * The Big Red Button to reset everything.
     */
    const handleNewTournament = () => {
        if (confirm("⚠️ ¿Estás seguro de iniciar una NUEVA JORNADA?\n\nEsto borrará todos los datos actuales y te llevará a la pantalla de configuración.\n\n(Asegúrate de haber archivado primero si quieres guardar historial)")) {
            clearTournament();
            router.push("/setup");
        }
    };

    return (
        <div className="min-h-screen bg-[#4A3B32] text-[#FDFBF7] font-hand p-4 pb-20">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col items-center text-center gap-4 mb-8">
                    <a href="/table-select" className="text-[#A5D6A7] flex items-center gap-2 hover:opacity-80 transition self-center">
                        <ArrowLeft size={20} /> Volver a la Mesa
                    </a>

                    <Trophy size={64} className="text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]" />
                    <h1 className="text-4xl font-bold mb-2">Tabla de Posiciones</h1>
                    <h2 className="text-4xl font-bold text-[#A5D6A7] uppercase tracking-wide opacity-80">RESULTADOS FINALES</h2>
                </div>

                {/* Leaderboard */}
                <div className="flex flex-col gap-4">
                    {stats.map((team, index) => {
                        const isFirst = index === 0;
                        const isSecond = index === 1;
                        const isThird = index === 2;

                        let rankColor = "bg-white/5 border-white/5";
                        let rankIcon = <span className="text-4xl font-bold opacity-30">#{index + 1}</span>;

                        if (isFirst) {
                            rankColor = "bg-[#FFD700]/10 border-[#FFD700]/30 shadow-[0_0_30px_rgba(255,215,0,0.1)]";
                            rankIcon = <Trophy className="text-[#FFD700]" size={48} />;
                        } else if (isSecond) {
                            rankColor = "bg-[#C0C0C0]/10 border-[#C0C0C0]/30";
                            rankIcon = <Medal className="text-[#C0C0C0]" size={40} />;
                        } else if (isThird) {
                            rankColor = "bg-[#CD7F32]/10 border-[#CD7F32]/30";
                            rankIcon = <Medal className="text-[#CD7F32]" size={36} />;
                        }

                        return (
                            <div key={team.pairId} className={`relative p-8 rounded-2xl border ${rankColor} transition-all hover:scale-[1.01]`}>
                                {isFirst && (
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#FFD700] text-[#4A3B32] px-8 py-2 rounded-full text-2xl font-black uppercase tracking-widest shadow-lg">
                                        CAMPEONES
                                    </div>
                                )}
                                <div className="flex items-center gap-8">
                                    <div className="w-16 flex justify-center">{rankIcon}</div>

                                    <div className="flex-1">
                                        <h2 className="text-3xl font-bold mb-1">{team.names.join(" & ")}</h2>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-5xl font-black text-[#A5D6A7] mb-2">{team.wins}V - {team.losses}D</div>
                                        <div className="text-xl font-bold font-mono opacity-80 mt-1">
                                            PG:{team.pointsScored} - PP:{team.pointsAllowed} = {team.pointDiff > 0 ? "+" : ""}{team.pointDiff}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Archive Actions */}
                <div className="mt-16 text-center space-y-10">

                    {/* Archive Button */}
                    <div>
                        <p className="opacity-80 text-xl font-medium mb-6">¿Terminó el torneo?</p>
                        <button
                            onClick={handleArchive}
                            disabled={isArchiving || archivedSuccess}
                            className={`
                                px-10 py-5 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 mx-auto transition-all text-xl
                                ${archivedSuccess
                                    ? "bg-[#81C784] text-[#1B5E20] cursor-default"
                                    : "bg-white/10 hover:bg-white/20 text-white"}
                            `}
                        >
                            {archivedSuccess ? <ShieldCheck size={28} /> : <Save size={28} />}
                            {archivedSuccess ? "Resultados Archivados" : (isArchiving ? "Guardando..." : "Archivar Torneo")}
                        </button>
                        {archivedSuccess && <p className="text-lg text-[#A5D6A7] mt-3 font-medium">Los datos están seguros en Supabase.</p>}
                    </div>

                    <div className="w-full h-px bg-white/10" />

                    {/* NEW TOURNAMENT BUTTON (RESET) */}
                    <div>
                        <button
                            onClick={handleNewTournament}
                            className="text-[#EF9A9A] hover:text-white hover:bg-[#EF9A9A]/20 px-8 py-4 rounded-xl transition-all flex items-center gap-3 mx-auto text-lg uppercase tracking-widest border border-transparent hover:border-[#EF9A9A]/20 font-bold"
                        >
                            <RefreshCw size={24} />
                            Iniciar Nueva Jornada (Reset)
                        </button>
                        <p className="text-sm opacity-50 mt-3 font-medium">
                            Esto borrará todos los datos del dispositivo para empezar desde cero.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
