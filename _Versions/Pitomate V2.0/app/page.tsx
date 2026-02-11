"use client";

/**
 * @file app/page.tsx
 * @description Landing Page (Home) of the application.
 * @author Antigravity (Google Deepmind)
 * 
 * MAIN RESPONSIBILITIES:
 * 1. Display the "Welcome" screen.
 * 2. Check Store for existing tournament configuration.
 * 3. CONTROL ACCESS: 
 *    - If NO tournament defaults -> "Soy Jugador" button is LOCKED.
 *    - If tournament configured -> "Soy Jugador" button is UNLOCKED.
 */

import { Trophy, Users, PlayCircle, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { OFFICIAL_PLAYERS } from '@/lib/constants';
import { useTournamentStore } from "@/lib/store"; // Quantum Store
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  // State for dynamic UI elements
  const [isHostMenuOpen, setIsHostMenuOpen] = useState(false); // Toggle for host menu
  const [currentDate, setCurrentDate] = useState(""); // Formatted date string

  // QUANTUM UPGRADE: Connect to Store
  const {
    isSetupComplete,
    hostName,
    pairs,
    clearTournament,
    initializeTournament // We might need this if we were hydrating from local manually, but persist does it.
  } = useTournamentStore();

  // Local state for host (visual only, unless we update store)
  const [displayHost, setDisplayHost] = useState(hostName || "Rudy");

  // Effect: Sync host name if store has one
  useEffect(() => {
    if (hostName) setDisplayHost(hostName);
  }, [hostName]);

  // Effect: Set the current date ON MOUNT
  useEffect(() => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formatted = date.toLocaleDateString('es-ES', options);
    setCurrentDate(formatted.charAt(0).toUpperCase() + formatted.slice(1));
  }, []);

  /**
   * GUARD: handlePlayerClick
   * Intercepts the click on "Soy Jugador".
   */
  const handlePlayerClick = (e: React.MouseEvent) => {
    if (!isSetupComplete) {
      e.preventDefault();
      alert("El anfitrión aún no ha configurado las parejas de esta jornada.");
    } else {
      // Explicit navigation to be safe
      e.preventDefault();
      router.push("/login");
    }
  };

  // Helper text
  const numPairs = Object.keys(pairs).length;
  const tournamentSummary = isSetupComplete
    ? `${numPairs * 2} Jugadores • ${numPairs > 0 ? numPairs - 1 : 0} Rondas por pareja`
    : "Esperando configuración de parejas...";

  const handleReset = () => {
    if (confirm("¿Estás seguro? Esto borrará toda la configuración de la jornada y el historial.")) {
      clearTournament();
      // Force hard reload to clear any lingering session state
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#5e4b41] via-[#4A3B32] to-[#2d241f] text-[#FDFBF7] font-hand flex items-center justify-center p-4">

      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-72 h-72 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-black/20 rounded-full blur-3xl"></div>
      </div>

      <div className="flex flex-col items-center gap-8 relative z-10 w-full max-w-lg">

        {/* Header */}
        <div className="text-center space-y-2 pt-10">
          <h1 className="text-4xl md:text-7xl font-bold tracking-tight drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-b from-[#FDFBF7] to-[#A5D6A7] leading-tight mb-4">
            3er Torneo del<br />Pitomate 2025-2026
          </h1>

          <div className="flex flex-col items-center gap-1">
            <p className="text-xl md:text-2xl font-light tracking-widest text-[#A5D6A7]/80 uppercase">
              {currentDate || "Cargando fecha..."}
            </p>

            {/* Jornada & Anfitrión Selector */}
            <div className="relative z-50">
              <button
                onClick={() => setIsHostMenuOpen(!isHostMenuOpen)}
                className="text-xl md:text-2xl font-light tracking-widest text-[#A5D6A7]/80 uppercase hover:text-[#FDFBF7] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>Jornada 1 de 16 • Anfitrión: <span className="font-bold border-b border-dashed border-[#A5D6A7]/50">{displayHost}</span></span>
                <ChevronDown size={20} className={`transform transition-transform ${isHostMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isHostMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#3E3129] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {OFFICIAL_PLAYERS.map((player) => (
                    <button
                      key={player}
                      onClick={() => {
                        setDisplayHost(player);
                        setIsHostMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-white/10 transition-colors ${displayHost === player ? 'bg-[#A5D6A7]/20 text-[#A5D6A7] font-bold' : 'text-[#FDFBF7]'}`}
                    >
                      {player}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="group relative w-full">
          <div className="absolute -inset-1 bg-white/10 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative border border-white/10 p-8 rounded-3xl bg-black/20 backdrop-blur-xl shadow-2xl">

            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white/5 rounded-full ring-1 ring-white/10 shadow-inner">
                <Trophy size={48} className="text-[#A5D6A7] drop-shadow-lg" strokeWidth={1.5} />
              </div>
            </div>

            <h2 className="text-3xl font-bold mb-2 text-center">Jornada 1</h2>
            <p className="text-xl md:text-2xl font-bold opacity-80 mb-8 text-center uppercase tracking-wide">
              {tournamentSummary}
            </p>

            <div className="space-y-4">
              <a
                href={isSetupComplete ? "/login" : "#"}
                onClick={handlePlayerClick}
                className={`
                  w-full py-5 text-xl font-bold rounded-xl shadow-[0_4px_20px_rgba(165,214,167,0.3)] transition-all flex items-center justify-center gap-3 group relative cursor-pointer
                  ${isSetupComplete
                    ? 'bg-[#A5D6A7] text-[#1B5E20] hover:bg-[#81C784] hover:scale-[1.02] active:scale-95'
                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed grayscale'}
                `}
              >
                <Users size={24} className={isSetupComplete ? "" : "opacity-20"} />
                <div className="flex flex-col items-start leading-none">
                  <span>Soy Jugador</span>
                  {!isSetupComplete && <span className="text-[10px] normal-case opacity-50 tracking-normal mt-1">Esperando configuración...</span>}
                </div>

                {isSetupComplete && (
                  <div className="absolute inset-0 rounded-2xl bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </a>

              <a href="/setup" className="w-full py-4 bg-white/5 text-white/60 text-lg font-bold rounded-xl hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-3 border border-white/5 group-hover:border-white/20">
                <PlayCircle size={24} />
                Configurar Jornada
              </a>
            </div>

          </div>
        </div>

        {/* Footer Info */}
        <div className="flex flex-col items-center gap-4 opacity-30 text-xs text-center">
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span>Gestión de Parejas v1.0</span>
          </div>

          <button
            onClick={handleReset}
            className="hover:text-red-400 underline decoration-dashed cursor-pointer"
          >
            [ Resetear Jornada & Datos ]
          </button>
        </div>

      </div>
    </div>
  );
}
