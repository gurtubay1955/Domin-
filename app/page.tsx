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

import { Trophy, Users, PlayCircle, ChevronDown, RotateCcw, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { OFFICIAL_PLAYERS } from '@/lib/constants';
import { useTournamentStore } from "@/lib/store"; // Quantum Store
import { useRouter } from 'next/navigation';
import PinGuard from '@/components/PinGuard'; // Import Guard


// Imports removed (Moved to GlobalSync)

export default function Home() {
  const router = useRouter();
  // State for dynamic UI elements
  const [isHostMenuOpen, setIsHostMenuOpen] = useState(false); // Toggle for host menu
  const [currentDate, setCurrentDate] = useState(""); // Formatted date string

  // QUANTUM UPGRADE: Connect to Store
  const {
    // tournamentId, (Removed - used in GlobalSync)
    isSetupComplete,
    hostName,
    pairs,
    matchHistory,
    // pairUuidMap, (Removed - used in GlobalSync)
    // initializeTournament, (Removed - used in GlobalSync)
    // syncMatch, (Removed - used in GlobalSync)
    nuclearReset // New Anti-Zombie Action
  } = useTournamentStore();

  // Local state for host (visual only, unless we update store)
  // FIX: Remove default "Rudy" to avoid ghost data
  const [displayHost, setDisplayHost] = useState(hostName || "");

  // Effect: Sync host name if store has one
  useEffect(() => {
    // If store has a name, use it. If not, clear it.
    setDisplayHost(hostName || "");
  }, [hostName]);

  // Effect: Set the current date ON MOUNT & Fetch Round Number
  const [roundNumber, setRoundNumber] = useState(1);

  useEffect(() => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formatted = date.toLocaleDateString('es-ES', options);
    setCurrentDate(formatted.charAt(0).toUpperCase() + formatted.slice(1));

    // Fetch Round Number from Cloud
    import('@/lib/tournamentService').then(({ getCompletedTournamentsCount }) => {
      getCompletedTournamentsCount().then(finishedCount => {
        // Logic: Current Round = Finished Rounds + 1
        setRoundNumber(finishedCount + 1);
      });
    });
  }, []);

  // 🔴 V4.7 REAL-TIME HOST SYNC
  // Subscribe to host_name changes in today's tournament
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    // Fetch current host on mount
    const fetchCurrentHost = async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('host_name')
        .eq('date', today)
        .maybeSingle();

      if (data?.host_name && data.host_name !== displayHost) {
        console.log('📡 Initial host from DB:', data.host_name);
        setDisplayHost(data.host_name);
      }
    };

    fetchCurrentHost();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('host_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
          filter: `date=eq.${today}`
        },
        (payload: any) => {
          console.log('🔥 HOST UPDATE:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newHost = (payload.new as any)?.host_name;
            // V4.9: Handle null host_name (reset scenario)
            if (newHost !== displayHost) {
              console.log('📡 Updating host from real-time:', newHost || '(cleared)');
              setDisplayHost(newHost || '');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [displayHost]);

  // --- V4.1 SYNC UPGRADE (FULL MATRIX) ---
  // MOVED TO GLOBAL COMPONENT <GlobalSync />


  /**
   * GUARD: handlePlayerClick
   * Intercepts the click on "Soy Jugador".
   */
  const handlePlayerClick = (e: React.MouseEvent) => {
    // ULTRA-STRICT GUARD: Must have setup AND a host assigned.
    if (!isSetupComplete || !hostName) {
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
  // Summary only shows if setup is legally complete (includes host)
  const tournamentSummary = (isSetupComplete && hostName)
    ? `${numPairs * 2} Jugadores • ${numPairs > 0 ? numPairs - 1 : 0} Rondas por pareja`
    : "Esperando configuración de parejas...";

  // Modal State
  const [showResetModal, setShowResetModal] = useState(false);

  const handleResetClick = () => {
    setShowResetModal(true);
  };

  const confirmReset = async () => {
    console.log("🔴 CONFIRM RESET: Starting reset process...");

    // 1. Kill Cloud Session (Wait for it!)
    try {
      const { deactivateTournament } = await import('@/lib/tournamentService');
      console.log("📤 Calling deactivateTournament...");
      const result = await deactivateTournament();
      console.log("✅ deactivateTournament result:", result);
    } catch (e) {
      console.error("❌ Failed to deactivate tournament:", e);
    }

    // 2. Kill Local Session (Only after cloud is dead)
    console.log("💣 Calling nuclearReset...");
    nuclearReset();
    setShowResetModal(false);
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
          <h1 className="text-4xl md:text-7xl font-bold tracking-tight drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-b from-[#FDFBF7] to-[#A5D6A7] leading-tight mb-4 selection:bg-[#A5D6A7] selection:text-[#1B5E20]">
            3er Torneo del<br />Pitomate 2025-2026
          </h1>

          <div className="flex flex-col items-center gap-1">
            <p className="text-2xl md:text-4xl font-light tracking-widest text-[#A5D6A7]/80 uppercase">
              {currentDate || "Cargando fecha..."}
            </p>

            {/* Jornada & Anfitrión Selector */}
            <div className="relative z-50">
              <button
                onClick={() => setIsHostMenuOpen(!isHostMenuOpen)}
                className="text-2xl md:text-4xl font-light tracking-widest text-[#A5D6A7]/80 uppercase hover:text-[#FDFBF7] transition-colors flex items-center gap-2 cursor-pointer mt-2"
              >
                <span>Jornada {roundNumber} de 16 • Anfitrión: <span className="font-bold border-b-2 border-dashed border-[#A5D6A7]/50">{displayHost || "Seleccionar..."}</span></span>
                <ChevronDown size={32} className={`transform transition-transform ${isHostMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isHostMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#3E3129] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {OFFICIAL_PLAYERS.map((player) => (
                    <button
                      key={player}
                      onClick={async () => {
                        setDisplayHost(player);
                        setIsHostMenuOpen(false);

                        // 🔴 V4.7: Save to Supabase for real-time sync
                        const { updateHostName } = await import('@/lib/tournamentService');
                        const result = await updateHostName(player);
                        if (!result.success) {
                          console.error('Failed to sync host:', result.error);
                        } else {
                          console.log('✅ Host synced to all devices:', player);
                        }
                      }}
                      className={`w-full text-left px-6 py-4 hover:bg-white/10 transition-colors text-2xl ${displayHost === player ? 'bg-[#A5D6A7]/20 text-[#A5D6A7] font-bold' : 'text-[#FDFBF7]'}`}
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

            <h2 className="text-5xl font-black mb-4 text-center text-white drop-shadow-lg">Jornada {roundNumber}</h2>
            <p className="text-3xl md:text-4xl font-bold opacity-90 mb-10 text-center uppercase tracking-wide text-[#A5D6A7]">
              {tournamentSummary}
            </p>

            <div className="space-y-4">
              <a
                href={(isSetupComplete && hostName) ? "/login" : "#"}
                onClick={handlePlayerClick}
                className={`
                  w-full py-8 text-4xl font-black rounded-2xl shadow-[0_4px_30px_rgba(165,214,167,0.4)] transition-all flex items-center justify-center gap-4 group relative cursor-pointer
                  ${(isSetupComplete && hostName)
                    ? 'bg-[#A5D6A7] text-[#1B5E20] hover:bg-[#81C784] hover:scale-[1.02] active:scale-95'
                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed grayscale'}
                `}
              >
                <Users size={48} className={(isSetupComplete && hostName) ? "" : "opacity-20"} strokeWidth={2.5} />
                <div className="flex flex-col items-start leading-none gap-2">
                  <span>SOY JUGADOR</span>
                  {(!isSetupComplete || !hostName) && <span className="text-xl normal-case opacity-60 tracking-normal font-medium">Esperando configuración...</span>}
                </div>

                {isSetupComplete && (
                  <div className="absolute inset-0 rounded-2xl bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </a>

              <button
                onClick={() => {
                  if (displayHost && !isSetupComplete) {
                    const target = `/setup?host=${encodeURIComponent(displayHost)}`;
                    router.push(target);
                  }
                }}
                disabled={!displayHost || isSetupComplete}
                className={`
                  w-full py-8 text-3xl font-black rounded-2xl transition-all flex items-center justify-center gap-4 border-2
                  ${isSetupComplete
                    ? "bg-[#A5D6A7]/20 text-[#A5D6A7] border-[#A5D6A7]/30 cursor-default"
                    : displayHost
                      ? "bg-white/5 text-white/90 hover:bg-white/10 hover:text-white hover:border-white/30 border-white/10 cursor-pointer"
                      : "bg-black/20 text-white/20 border-white/5 cursor-not-allowed"
                  }
                `}
              >
                {isSetupComplete ? (
                  <>
                    <Check size={40} strokeWidth={3} />
                    JORNADA ACTIVA
                  </>
                ) : (
                  <>
                    <PlayCircle size={40} strokeWidth={2.5} className={displayHost ? "" : "opacity-20"} />
                    {displayHost ? "SELECCIONAR PAREJAS" : "ELIGE ANFITRIÓN PRIMERO"}
                  </>
                )}
              </button>
            </div>

          </div>
        </div>


        {/* Footer Info */}
        <div className="flex flex-col items-center gap-6 opacity-40 text-xl text-center font-bold tracking-widest mt-8">
          <Users size={18} />
          <span>SISTEMA V6.0.1 (AUDITOR) • {matchHistory.length} PARTIDAS RECUPERADAS</span>
        </div>

        <div className="flex gap-6 mt-4">
          <PinGuard
            onVerify={handleResetClick}
            title="Reset Nuclear"
            description="¿Seguro? Se requiere autorización nivel Supervisor."
          >
            <button
              className="p-4 bg-white/5 hover:bg-white/10 text-white/30 hover:text-red-400 rounded-full transition-all hover:scale-110 active:scale-95 group"
              title="Resetear Jornada"
            >
              <RotateCcw size={32} className="group-hover:rotate-180 transition-transform duration-700" />
            </button>
          </PinGuard>
          <a
            href="/stats"
            className="p-4 bg-white/5 hover:bg-white/10 text-[#FFD700]/50 hover:text-[#FFD700] rounded-full transition-all hover:scale-110 active:scale-95 group"
            title="Estadísticas del Torneo"
          >
            <Trophy size={32} className="group-hover:animate-bounce transition-transform duration-700" />
          </a>
        </div>
      </div>

      {/* CUSTOM RESET MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-[#3E3129] border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200 ring-1 ring-white/5">
            <h3 className="text-2xl font-bold text-white mb-2">¿Resetear Jornada?</h3>
            <p className="text-white/60 mb-6 font-medium">
              Esto borrará toda la configuración actual, incluyendo el anfitrión y las parejas. <br /><br />
              <span className="text-red-400 font-bold bg-red-950/30 px-2 py-1 rounded inline-block">Esta acción es irreversible ☢️</span>
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors border border-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReset}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors shadow-[0_0_20px_rgba(220,38,38,0.4)] border border-red-400/20"
              >
                Sí, Resetear
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
