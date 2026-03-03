"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Activity, Target, Flame, Star, Zap } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/**
 * @file app/analytics/page.tsx
 * @description Domino Analytics Dashboard V3.0
 * Features Dual Leaderboards (Official Standings & Quality Excellence)
 */

export default function AnalyticsDashboard() {
    const router = useRouter();
    const [officialStandings, setOfficialStandings] = useState<any[]>([]);
    const [qualityStandings, setQualityStandings] = useState<any[]>([]);
    const [matchStats, setMatchStats] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // 1. Fetch Official Standings (Table 1: Attendance + Wins)
                const { data: official, error: offError } = await supabase
                    .from('view_official_standings')
                    .select('*')
                    .order('points_total', { ascending: false })
                    .order('point_diff', { ascending: false });

                if (offError) console.warn("view_official_standings missing or empty", offError);

                // 2. Fetch Quality Standings (Table 2: Margins + Shoes)
                const { data: quality, error: qualError } = await supabase
                    .from('view_quality_standings')
                    .select('*')
                    .order('total_quality_points', { ascending: false })
                    .order('total_shoes', { ascending: false });

                if (qualError) console.warn("view_quality_standings missing or empty", qualError);

                // 3. Fetch Match-Level Stats (Friction/Venom)
                const { data: matchData, error: matchError } = await supabase
                    .from('view_match_analytics')
                    .select('*');

                if (matchError) {
                    console.warn("view_match_analytics error", matchError);
                }

                setOfficialStandings(official || []);
                setQualityStandings(quality || []);
                setMatchStats(matchData || []);
            } catch (e) {
                console.error("Error fetching analytics:", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    return (
        <div className="min-h-screen bg-[#4A3B32] text-[#FDFBF7] font-hand p-4 pb-20">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col items-center text-center gap-4 mb-8">
                    <button
                        onClick={() => router.push("/")}
                        className="text-[#A5D6A7] flex items-center gap-2 hover:opacity-80 transition self-center"
                    >
                        <ArrowLeft size={20} /> Volver al Inicio
                    </button>

                    <div className="p-4 bg-black/20 rounded-full border border-white/10 mb-2">
                        <Activity size={48} className="text-[#FFB74D]" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-r from-[#FFB74D] to-[#FF8A65]">
                        Domino Analytics
                    </h1>
                    <h2 className="text-xl md:text-2xl font-bold text-[#A5D6A7] tracking-wide opacity-80 uppercase text-center w-full block">
                        Temporada Pitomate 2026
                    </h2>
                </div>

                {isLoading ? (
                    <div className="text-center text-xl opacity-50 py-20 font-bold">Cargando base de datos histórica...</div>
                ) : (
                    <div className="space-y-16">

                        {/* 1. SECCIÓN STANDINGS OFICIALES (TABLA 1) */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <Trophy className="text-[#FFD700]" />
                                <h3 className="text-2xl md:text-3xl font-bold border-b-2 border-white/10 pb-2 w-full">Standings Oficiales</h3>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl bg-black/20">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/40 text-[10px] md:text-sm uppercase tracking-wider text-[#A5D6A7]">
                                            <th className="p-4 font-bold">Pos</th>
                                            <th className="p-4 font-bold">Jugador</th>
                                            <th className="p-4 font-bold text-center">Puntos (Pasada + Hoy)</th>
                                            <th className="p-4 font-bold text-center">Dif. Puntos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {officialStandings.length > 0 ? officialStandings.map((player, index) => (
                                            <tr key={player.player_name + index} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-black text-xl opacity-50">#{index + 1}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-xl md:text-2xl leading-tight">
                                                        {player.player_name || "Desconocido"}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-2xl md:text-3xl font-black text-[#FFD700] drop-shadow-md">
                                                            {player.points_total}
                                                        </span>
                                                        <span className="text-xs opacity-60 font-mono whitespace-nowrap">
                                                            {player.points_prev} + {player.points_today}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`text-xl font-bold ${player.point_diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {player.point_diff > 0 ? `+${player.point_diff}` : player.point_diff}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center opacity-30 italic">No hay datos disponibles. Aplica la migración SQL.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-4 text-sm opacity-60 italic text-center">
                                * Criterio: Puntos totales (Asistencia + Victoria). Desempate por Diferencial Global.
                            </p>
                        </section>

                        {/* 2. SECCIÓN CALIDAD Y EXCELENCIA (TABLA 2) */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <Star className="text-blue-400" />
                                <h3 className="text-2xl md:text-3xl font-bold border-b-2 border-white/10 pb-2 w-full">Analítica de Calidad (Excelencia)</h3>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl bg-gradient-to-br from-blue-900/10 to-black/20">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/40 text-[10px] md:text-sm uppercase tracking-wider text-blue-300">
                                            <th className="p-4 font-bold">Pos</th>
                                            <th className="p-4 font-bold">Jugador</th>
                                            <th className="p-4 font-bold text-center">Puntaje Diferencial</th>
                                            <th className="p-4 font-bold text-center">👟 Zapatos Acum.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {qualityStandings.length > 0 ? qualityStandings.map((player, index) => (
                                            <tr key={player.player_name + index} className="hover:bg-blue-400/5 transition-colors">
                                                <td className="p-4 font-black text-xl opacity-50">#{index + 1}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-xl md:text-2xl leading-tight">
                                                        {player.player_name || "Desconocido"}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`text-3xl font-black drop-shadow-md ${player.total_quality_points >= 0 ? 'text-blue-300' : 'text-orange-400'}`}>
                                                        {player.total_quality_points > 0 ? `+${player.total_quality_points}` : player.total_quality_points}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {player.total_shoes > 0 ? (
                                                        <div className="flex items-center justify-center gap-1 group">
                                                            <span className="text-2xl font-black text-blue-200">x{player.total_shoes}</span>
                                                            <Zap className="text-yellow-400 animate-pulse" size={20} />
                                                        </div>
                                                    ) : <span className="opacity-20">-</span>}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center opacity-30 italic whitespace-nowrap">No hay datos de calidad todavía.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-4 text-[10px] md:text-xs opacity-60 italic text-center text-blue-200/50">
                                * Lógica: DobleZap (+3/-3), Sencillo (+2/-2), Normal (+1/-1). Zapatos Dobles valen 2, Sencillos 1.
                            </p>
                        </section>

                        {/* 3. MÉTRICAS AVANZADAS (Fricción/Letalidad) */}
                        {matchStats.length > 0 && (
                            <section className="mt-16 bg-white/5 rounded-3xl p-8 border border-white/10 shadow-2xl">
                                <div className="flex items-center gap-3 mb-8 justify-center border-b border-white/10 pb-4">
                                    <Flame size={40} className="text-[#FF8A65]" />
                                    <h3 className="text-3xl font-bold text-center">Índice de Fricción & Letalidad</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                                    <div className="space-y-2">
                                        <h4 className="text-[#FFB74D] font-bold uppercase tracking-widest text-sm">🛡️ Las Trincheras</h4>
                                        <p className="text-[10px] opacity-60">Mayores Partidas (Manos)</p>
                                    </div>
                                    <div className="space-y-2 border-x border-white/10">
                                        <h4 className="text-[#A5D6A7] font-bold uppercase tracking-widest text-sm">⚡ Blitzkrieg</h4>
                                        <p className="text-[10px] opacity-60">Victorias Relámpago</p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-blue-300 font-bold uppercase tracking-widest text-sm">🦂 Letalidad (PPM)</h4>
                                        <p className="text-[10px] opacity-60">Puntos por Mano</p>
                                    </div>
                                </div>
                            </section>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
}
