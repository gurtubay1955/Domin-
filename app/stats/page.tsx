"use client";

import { useSafeTournamentStore } from "@/lib/store";
import { calculateStats, PlayerStats } from "@/lib/statsService";
import { ArrowLeft, Trophy, Flame, Skull, Crown, AlertOctagon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StatsPage() {
    const router = useRouter();
    const { safeMatchHistory, safePairs, isReady } = useSafeTournamentStore();
    const [stats, setStats] = useState<ReturnType<typeof calculateStats> | null>(null);

    useEffect(() => {
        if (isReady && safeMatchHistory) {
            // Calculate stats whenever store is ready
            // Note: 'allPairs' needs to be resolved. For now we use safePairs but 
            // the service might need a more robust way to map IDs if they are complex.
            // In the simple version, matchHistory has "oppNames" but "myPair" is ID.
            // We'll assume the service handles what it can.

            // FIX: We need to pass a map of PairID -> PlayerNames
            // safePairs is Record<string, string[]>
            const computed = calculateStats(safeMatchHistory, safePairs);
            setStats(computed);
        }
    }, [isReady, safeMatchHistory, safePairs]);

    if (!stats) {
        return (
            <div className="min-h-screen bg-[#4A3B32] flex items-center justify-center text-[#A5D6A7]">
                <div className="animate-pulse text-2xl font-bold">Calculando Estadísticas...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#4A3B32] text-[#FDFBF7] font-hand p-4 pb-20">
            {/* Header */}
            <div className="flex flex-col items-center text-center gap-6 mb-12">
                <a href="/" className="text-[#A5D6A7] flex items-center gap-2 hover:opacity-80 transition self-start text-3xl font-bold">
                    <ArrowLeft size={32} /> Volver
                </a>

                <div>
                    <h1 className="text-6xl font-bold mb-4 text-white flex items-center gap-4 justify-center">
                        <Trophy className="text-[#FFD700]" size={64} />
                        Estadísticas Pitomate
                    </h1>
                    <p className="opacity-80 text-3xl text-white font-medium">
                        Juegos: {stats.seasonPlayedGames} / {stats.seasonTotalGames}
                    </p>
                </div>
            </div>

            {/* LEADERBOARDS GRID */}
            <div className="max-w-8xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-12">

                {/* 1. TABLA GENERAL (PUNTOS) */}
                <div className="bg-black/20 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-sm shadow-2xl">
                    <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
                        <Crown className="text-[#FFD700]" size={48} />
                        <h2 className="text-5xl font-black text-[#FFD700]">Tabla General</h2>
                        <span className="text-xl opacity-60 ml-auto uppercase tracking-widest font-sans font-bold">Ordenado por Puntos</span>
                    </div>

                    <div className="space-y-4">
                        {stats.leaderboard.map((player, index) => (
                            <div key={player.name} className={`flex justify-between items-center p-6 rounded-2xl ${index < 3 ? 'bg-white/10 border border-white/10 shadow-lg' : 'bg-transparent border-b border-white/5'}`}>
                                <div className="flex items-center gap-6">
                                    <div className={`
                                        w-14 h-14 rounded-full flex items-center justify-center font-black text-3xl shadow-md
                                        ${index === 0 ? 'bg-[#FFD700] text-black shadow-[0_0_20px_rgba(255,215,0,0.6)] scale-110' :
                                            index === 1 ? 'bg-[#C0C0C0] text-black' :
                                                index === 2 ? 'bg-[#CD7F32] text-black' : 'bg-white/5 text-white/50'}
                                    `}>
                                        {index + 1}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-4xl font-bold tracking-tight ${index === 0 ? 'text-[#FFD700]' : 'text-white'}`}>{player.name}</span>
                                        <span className="text-xl opacity-70 flex gap-4 font-medium">
                                            <span>Match: {player.matchesPlayed}</span>
                                            <span className="text-[#A5D6A7]">W: {player.matchesWon}</span>
                                            <span className="text-[#EF9A9A]">L: {player.matchesLost}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <div className="text-6xl font-black text-[#A5D6A7] drop-shadow-md leading-none">{player.totalPoints}</div>
                                    <div className="text-xl opacity-60 uppercase tracking-widest font-bold mt-1">Puntos</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. TABLA AGRESIVIDAD */}
                <div className="bg-black/20 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-sm shadow-2xl">
                    <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
                        <Flame className="text-orange-500" size={48} />
                        <h2 className="text-5xl font-black text-orange-400">Agresividad</h2>
                        <span className="text-xl opacity-60 ml-auto uppercase tracking-widest font-sans font-bold">Zapateros Index</span>
                    </div>

                    <p className="text-xl opacity-60 mb-6 px-2 font-medium">
                        Fórmula: (3x DblZap + 2x SglZap + 1x Normal) - (Perdidos)
                    </p>

                    <div className="space-y-4">
                        {stats.aggressivenessLeaderboard.map((player, index) => (
                            <div key={player.name} className="flex justify-between items-center p-6 rounded-2xl border-b border-white/5 hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-6">
                                    <div className="text-3xl font-bold opacity-30 w-10 text-center">{index + 1}</div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-4xl font-bold text-white/95">{player.name}</span>
                                        <div className="flex text-xl gap-4 mt-1 opacity-80 font-mono font-bold">
                                            <span className="text-green-400" title="Zapateros Dobles Ganados">ZD:{player.winsDoubleZapatero}</span>
                                            <span className="text-green-300" title="Zapateros Sencillos Ganados">ZS:{player.winsSingleZapatero}</span>
                                            <span className="text-red-400" title="Zapateros Dobles Perdidos">ZD-:{player.lostDoubleZapatero}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <div className={`text-6xl font-black leading-none ${player.aggressivenessScore >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                                        {player.aggressivenessScore}
                                    </div>
                                    <div className="text-xl opacity-60 uppercase tracking-widest font-bold mt-1">Idx</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECCIÓN INFERIOR: HOSTS Y DETALLES */}
            <div className="max-w-8xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-2 gap-12">

                {/* HOSTS PENDING */}
                <div className="bg-white/5 p-8 rounded-3xl border border-white/5 shadow-xl">
                    <h3 className="text-3xl font-black text-[#A5D6A7] mb-6 uppercase tracking-widest flex items-center gap-3">
                        <AlertOctagon size={32} /> Anfitriones Pendientes
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {stats.hostsPending.map(host => (
                            <span key={host} className="px-5 py-3 bg-white/10 rounded-xl text-2xl font-bold text-white/90 border border-white/10 shadow-sm">
                                {host}
                            </span>
                        ))}
                    </div>
                </div>

                {/* DETALLES DE JUEGO */}
                <div className="bg-white/5 p-8 rounded-3xl border border-white/5 shadow-xl">
                    <h3 className="text-3xl font-black text-[#A5D6A7] mb-6 uppercase tracking-widest">
                        Métricas Globales
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-black/20 p-6 rounded-2xl flex flex-col items-center">
                            <div className="text-xl opacity-60 mb-2 font-bold uppercase tracking-wider">Efectividad General</div>
                            <div className="text-5xl font-black text-white">--%</div>
                        </div>
                        <div className="bg-black/20 p-6 rounded-2xl flex flex-col items-center">
                            <div className="text-xl opacity-60 mb-2 font-bold uppercase tracking-wider">Duración Promedio</div>
                            <div className="text-5xl font-black text-white">-- min</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
