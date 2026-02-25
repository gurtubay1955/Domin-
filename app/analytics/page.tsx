"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Activity, Target, Flame } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/**
 * @file app/analytics/page.tsx
 * @description Domino Analytics Dashboard
 * Consumes the view_leaderboard_standings and view_match_analytics
 */

export default function AnalyticsDashboard() {
    const router = useRouter();
    const [standings, setStandings] = useState<any[]>([]);
    const [matchStats, setMatchStats] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // Fetch Global Standings (Championship Points) - AHORA INDIVIDUAL
                const { data, error } = await supabase
                    .from('view_player_standings')
                    .select('*')
                    .order('total_championship_points', { ascending: false })
                    .order('point_diff', { ascending: false });

                if (error) throw error;

                // Fetch Match-Level Stats
                const { data: matchData, error: matchError } = await supabase
                    .from('view_match_analytics')
                    .select('*');

                if (matchError) throw matchError;

                setStandings(data || []);
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
                        onClick={() => router.back()}
                        className="text-[#A5D6A7] flex items-center gap-2 hover:opacity-80 transition self-center"
                    >
                        <ArrowLeft size={20} /> Volver
                    </button>

                    <div className="p-4 bg-black/20 rounded-full border border-white/10 mb-2">
                        <Activity size={48} className="text-[#FFB74D]" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-r from-[#FFB74D] to-[#FF8A65]">
                        Domino Analytics
                    </h1>
                    <h2 className="text-xl md:text-2xl font-bold text-[#A5D6A7] tracking-wide opacity-80 uppercase">
                        Rendimiento Avanzado
                    </h2>
                </div>

                {isLoading ? (
                    <div className="text-center text-xl opacity-50 py-20 font-bold">Cargando base de datos histórica...</div>
                ) : (
                    <div className="space-y-12">

                        {/* 1. SECCIÓN STANDINGS OFICIALES */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <Trophy className="text-[#FFD700]" />
                                <h3 className="text-3xl font-bold border-b-2 border-white/10 pb-2 w-full">Standings Oficiales (Puntos de Campeonato)</h3>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl bg-black/20">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/40 text-sm md:text-base uppercase tracking-wider text-[#A5D6A7]">
                                            <th className="p-4 font-bold">Pos</th>
                                            <th className="p-4 font-bold">Jugador</th>
                                            <th className="p-4 font-bold text-center">PTS Totales</th>
                                            <th className="p-4 font-bold text-center">V-D</th>
                                            <th className="p-4 font-bold text-center">Dif. Puntos</th>
                                            <th className="p-4 font-bold text-center" title="Zapateros Dados">👟 Dados</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {standings.map((player, index) => (
                                            <tr key={player.player_name + index} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-black text-xl opacity-50">#{index + 1}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-2xl leading-tight">
                                                        {player.player_name || "Desconocido"}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="text-3xl font-black text-[#FFD700] drop-shadow-md">
                                                        {player.total_championship_points}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center font-mono font-bold opacity-90 text-2xl">
                                                    <span className="text-green-400">{player.total_wins}</span>
                                                    <span className="opacity-50 mx-1">-</span>
                                                    <span className="text-red-400">{player.total_losses}</span>
                                                </td>
                                                <td className="p-4 text-center font-mono text-2xl opacity-80">
                                                    {player.point_diff > 0 ? '+' : ''}{player.point_diff}
                                                </td>
                                                <td className="p-4 text-center text-2xl">
                                                    {player.zapateros_dados > 0 && (
                                                        <span className="text-blue-300 drop-shadow-md" title={`${player.zapateros_dados} Zapateros Dobles Dados`}>
                                                            👟 x{player.zapateros_dados}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-4 text-sm opacity-60 italic text-center">
                                * Puntos de campeonato calculados según las Reglas de Temporada Activas al momento del partido.
                            </p>
                        </section>

                        {/* MÁS SECCIONES COMO ÍNDICE DE FRICCIÓN AQUÍ */}
                        <section className="mt-16 bg-white/5 rounded-3xl p-8 border border-white/10">
                            <div className="flex items-center gap-3 mb-8 justify-center border-b border-white/10 pb-4">
                                <Flame size={40} className="text-[#FF8A65]" />
                                <h3 className="text-3xl font-bold text-center">Índice de Fricción & Rendimiento</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                                {/* 1. LAS TRINCHERAS (Partidas más largas) */}
                                <div className="bg-black/30 rounded-2xl p-6 border border-white/5 shadow-inner">
                                    <h4 className="text-xl font-bold text-[#FFB74D] flex items-center justify-between mb-4">
                                        🛡️ Trinchera (Largas)
                                    </h4>
                                    <div className="space-y-4">
                                        {[...matchStats]
                                            .sort((a, b) => b.total_hands_played - a.total_hands_played)
                                            .slice(0, 3)
                                            .map((m, i) => (
                                                <div key={m.match_id} className="bg-white/5 p-4 rounded-xl flex flex-col gap-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs opacity-50 uppercase font-bold">TOP {i + 1}</span>
                                                        <span className="text-xl font-black text-red-300">{m.total_hands_played} Manos</span>
                                                    </div>
                                                    <div className="text-sm font-medium mt-1">
                                                        {m.pair_a_names.join(" & ")} vs {m.pair_b_names.join(" & ")}
                                                    </div>
                                                    <div className="text-xs opacity-60 font-mono mt-1">
                                                        Resultado: {m.score_a} - {m.score_b}
                                                    </div>
                                                </div>
                                            ))}
                                        {matchStats.length === 0 && <p className="opacity-50 text-sm">Sin datos</p>}
                                    </div>
                                </div>

                                {/* 2. BLITZ (Partidas más cortas) */}
                                <div className="bg-black/30 rounded-2xl p-6 border border-white/5 shadow-inner">
                                    <h4 className="text-xl font-bold text-[#A5D6A7] flex items-center justify-between mb-4">
                                        ⚡ Blitz (Rápidas)
                                    </h4>
                                    <div className="space-y-4">
                                        {[...matchStats]
                                            .filter(m => m.total_hands_played > 0)
                                            .sort((a, b) => a.total_hands_played - b.total_hands_played)
                                            .slice(0, 3)
                                            .map((m, i) => (
                                                <div key={m.match_id} className="bg-white/5 p-4 rounded-xl flex flex-col gap-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs opacity-50 uppercase font-bold">TOP {i + 1}</span>
                                                        <span className="text-xl font-black text-yellow-300">{m.total_hands_played} Manos</span>
                                                    </div>
                                                    <div className="text-sm font-medium mt-1">
                                                        {m.pair_a_names.join(" & ")} vs {m.pair_b_names.join(" & ")}
                                                    </div>
                                                    <div className="text-xs opacity-60 font-mono mt-1">
                                                        Resultado: {m.score_a} - {m.score_b}
                                                    </div>
                                                </div>
                                            ))}
                                        {matchStats.length === 0 && <p className="opacity-50 text-sm">Sin datos</p>}
                                    </div>
                                </div>

                                {/* 3. RENDIMIENTO OFENSIVO (PPM) */}
                                <div className="bg-black/30 rounded-2xl p-6 border border-white/5 shadow-inner">
                                    <h4 className="text-xl font-bold text-blue-300 flex items-center justify-between mb-4">
                                        🦂 Veneno (Eficiencia)
                                    </h4>
                                    <div className="space-y-4">
                                        {[...matchStats]
                                            .filter(m => m.winner_ppm > 0)
                                            .sort((a, b) => b.winner_ppm - a.winner_ppm)
                                            .slice(0, 3)
                                            .map((m, i) => (
                                                <div key={m.match_id} className="bg-white/5 p-4 rounded-xl flex flex-col gap-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs opacity-50 uppercase font-bold">TOP {i + 1}</span>
                                                        <span className="text-xl font-black text-blue-300" title="Puntos por Mano Promedio del Ganador">
                                                            {Number(m.winner_ppm).toFixed(1)} PPM
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-medium mt-1">
                                                        {m.score_a >= 100 ? m.pair_a_names.join(" & ") : m.pair_b_names.join(" & ")}
                                                    </div>
                                                    <div className="text-xs opacity-60 font-mono mt-1">
                                                        Víctimas: {m.score_a < 100 ? m.pair_a_names.join(" & ") : m.pair_b_names.join(" & ")}
                                                    </div>
                                                </div>
                                            ))}
                                        {matchStats.length === 0 && <p className="opacity-50 text-sm">Sin datos</p>}
                                    </div>
                                </div>

                            </div>
                        </section>

                    </div>
                )}
            </div>
        </div>
    );
}
