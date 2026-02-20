import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect, useState } from 'react';

/**
 * 🧟 STORE ANTI-ZOMBIE v2.0
 * 
 * PROBLEMA ORIGINAL: Datos persisten después de reset debido a:
 * 1. Asincronía entre Zustand-hydration y localStorage.clear()
 * 2. Caché del App Router de Next.js
 * 3. Service Workers (PWA)
 * 4. Estado en memoria vs estado serializado
 * 
 * SOLUCIÓN: Protocolo atómico de reset con estados de control
 */

export interface MatchRecord {
    id: string;
    tournamentId: string;
    myPair: number;
    oppPair: number;
    scoreMy: number;
    scoreOpp: number;
    oppNames: string[];
    timestamp: number;
    // 📊 NEW STATS FIELDS
    handsMy: number;      // Manos ganadas por mi
    handsOpp: number;     // Manos ganadas por ellos
    isZapatero: 'double' | 'single' | 'none'; // Tipo de victoria/derrota
}

// 🔴 V4.5 LIVE SYNC DATA
export interface LiveMatchData {
    tournamentId: string;
    pairA: number; // Always sorted pairA < pairB
    pairB: number;
    scoreA: number;
    scoreB: number;
    handNumber: number;
    lastUpdated: string;
}

interface TournamentState {
    // Estados principales
    tournamentId: string | null;
    hostName: string;
    pairs: Record<string, string[]>;
    pairUuidMap: Record<string, number>; // 🗺️ V4.1: UUID -> Pair Number Map
    matchHistory: MatchRecord[];
    liveScores: Record<string, LiveMatchData>; // 🔴 V4.5: Active Games
    isSetupComplete: boolean;

    // 🔮 ESTADOS DE CONTROL ANTI-ZOMBIE
    _hasHydrated: boolean;          // ¿Ya se hidrató desde localStorage?
    _isResetting: boolean;          // ¿Estamos en medio de un reset?
    _resetTimestamp: number | null; // Cuándo fue el último reset

    // Acciones principales
    initializeTournament: (id: string, host: string, pairs: Record<string, string[]>, existingMatches?: MatchRecord[], pairUuidMap?: Record<string, number>) => void;
    addMatch: (match: MatchRecord) => void;
    syncMatch: (match: MatchRecord) => void; // ☁️ V4.1: Recibir de la nube
    syncMatches: (matches: MatchRecord[]) => void; // ☁️ V4.2: Polling Fallback
    syncLiveMatch: (data: LiveMatchData) => void; // 🔴 V4.5: Update live score
    removeLiveScore: (pairA: number, pairB: number) => void; // 🧹 V5.0: Realtime DELETE
    setLiveScores: (fullList: LiveMatchData[]) => void; // 🔄 V5.0: Full Replace (Polling)
    clearTournament: () => void;
    getPairNames: (pairId: number) => string[];

    // 🛡️ ACCIONES ANTI-ZOMBIE
    markAsHydrated: () => void;
    beginReset: () => void;
    completeReset: () => void;

    // 💣 RESETS A DIFERENTES NIVELES
    softReset: () => void;           // Solo memoria (inmediato)
    hardReset: () => Promise<void>;  // Memoria + localStorage (async)
    nuclearReset: () => Promise<void>; // Todo + recarga forzada
}

export const useTournamentStore = create<TournamentState>()(
    persist(
        (set, get) => ({
            // Estados iniciales
            tournamentId: null,
            hostName: "",
            pairs: {},
            pairUuidMap: {},
            matchHistory: [],
            liveScores: {}, // 🔴 Init
            isSetupComplete: false,

            // Estados de control iniciales
            _hasHydrated: false,
            _isResetting: false,
            _resetTimestamp: null,

            // Acciones principales
            initializeTournament: (id, host, pairs, existingMatches = [], pairUuidMap = {}) => {
                console.log("🌀 STORE: Inicializando torneo...", id);
                set({
                    tournamentId: id,
                    hostName: host,
                    pairs: pairs,
                    pairUuidMap: pairUuidMap,
                    matchHistory: existingMatches, // V4.1: Hydrate history
                    isSetupComplete: true,
                    _hasHydrated: true // Marcar como hidratado
                });
            },

            addMatch: (match) => {
                set((state) => {
                    // Prevenir duplicados
                    const exists = state.matchHistory.some(m => m.id === match.id);
                    if (exists) return state;

                    // 🧹 Cleanup Live Score for this match (Atomic update)
                    // Pair A is usually min(myPair, oppPair) in live logic, but let's just clear consistent key
                    const pA = Math.min(match.myPair, match.oppPair);
                    const pB = Math.max(match.myPair, match.oppPair);
                    const key = `${pA}-${pB}`;

                    const { [key]: _, ...remainingLive } = state.liveScores;

                    console.log(`🧹 STORE: Partida finalizada en OFF-LINE Fallback. Limpiando marcador en vivo localmente para ${key}`);

                    return {
                        matchHistory: [...state.matchHistory, match],
                        liveScores: remainingLive // Remove "Watching" status
                    };
                });
            },

            syncMatch: (match) => {
                set((state) => {
                    // Prevenir duplicados estrictos (CRÍTICO para eventos realtime de la misma partida)
                    const exists = state.matchHistory.some(m => m.id === match.id);
                    if (exists) {
                        return state; // No hacemos re-render si el ID ya bajó
                    }

                    console.log("📥 SYNC: Partida FINALIZADA recibida de la nube", match.id);

                    // 🧹 Cleanup Live Score (Remote finish)
                    const pA = Math.min(match.myPair, match.oppPair);
                    const pB = Math.max(match.myPair, match.oppPair);
                    const key = `${pA}-${pB}`;
                    const { [key]: _, ...remainingLive } = state.liveScores;

                    // 🟢 SSOT: Siempre creamos un nuevo array de histórico para reactivivdad UI
                    return {
                        matchHistory: [...state.matchHistory, match],
                        liveScores: remainingLive
                    };
                });
            },

            syncMatches: (matches) => {
                set((state) => {
                    // Filter out existing matches
                    const newMatches = matches.filter(m => !state.matchHistory.some(existing => existing.id === m.id));

                    if (newMatches.length === 0) return state;

                    console.log(`📥 SYNC BULK: ${newMatches.length} nuevas partidas recibidas.`);

                    // Cleanup any live scores that are now finished
                    let newLive = { ...state.liveScores };
                    newMatches.forEach(m => {
                        const pA = Math.min(m.myPair, m.oppPair);
                        const pB = Math.max(m.myPair, m.oppPair);
                        delete newLive[`${pA}-${pB}`];
                    });

                    return {
                        matchHistory: [...state.matchHistory, ...newMatches],
                        liveScores: newLive
                    };
                });
            },

            // 🔴 V4.5 LIVE SYNC ACTION
            syncLiveMatch: (data) => {
                set((state) => {
                    const key = `${data.pairA}-${data.pairB}`;

                    // If this match is somehow already in history (race condition), ignore live update
                    const historyExists = state.matchHistory.some(m => {
                        const mPA = Math.min(m.myPair, m.oppPair);
                        const mPB = Math.max(m.myPair, m.oppPair);
                        return mPA === data.pairA && mPB === data.pairB && m.timestamp > Date.parse(data.lastUpdated);
                    });

                    if (historyExists) return state;

                    console.log(`🔴 LIVE UPDATE: Mesa ${data.pairA} vs ${data.pairB} => ${data.scoreA}-${data.scoreB}`);

                    return {
                        liveScores: {
                            ...state.liveScores,
                            [key]: data
                        }
                    };
                });
            },

            // 🧹 V5.0: REMOVE LIVE MATCH (Realtime DELETE)
            removeLiveScore: (pairA, pairB) => {
                set((state) => {
                    const key = `${pairA}-${pairB}`;
                    if (!state.liveScores[key]) return state; // No-op

                    console.log(`🗑️ STORE: Removing live match ${key}`);
                    const { [key]: _, ...rest } = state.liveScores;
                    return { liveScores: rest };
                });
            },

            // 🔄 V5.0: SET FULL LIVE SCORES (Polling Replacement)
            setLiveScores: (fullList) => {
                set((state) => {
                    const newLive: Record<string, LiveMatchData> = {};

                    fullList.forEach(data => {
                        // ZOMBIE CHECK (Redundant but safe)
                        const historyExists = state.matchHistory.some(m => {
                            const mPA = Math.min(m.myPair, m.oppPair);
                            const mPB = Math.max(m.myPair, m.oppPair);
                            return mPA === data.pairA && mPB === data.pairB;
                        });

                        if (!historyExists) {
                            const key = `${data.pairA}-${data.pairB}`;
                            newLive[key] = data;
                        }
                    });

                    // Compare keys to avoid unnecessary re-renders? 
                    // Zustand does shallow compare, but creating new object always triggers.
                    // But this runs every 2s. Is it okay? Yes, functionality is priority.

                    return { liveScores: newLive };
                });
            },

            // 🔄 Acciones de control anti-zombie
            markAsHydrated: () => {
                set({ _hasHydrated: true });
            },

            beginReset: () => {
                set({ _isResetting: true, _resetTimestamp: Date.now() });
            },

            completeReset: () => {
                set({ _isResetting: false });
            },

            // 💣 Nivel 1: Reset Suave (solo memoria)
            softReset: () => {
                console.log("🔄 Reset suave: solo memoria");
                set({
                    tournamentId: null,
                    hostName: "",
                    pairs: {},
                    pairUuidMap: {}, // 🧹 V4.2.1 Fix: Clear Map
                    matchHistory: [],
                    liveScores: {}, // 🔴 Clear Live
                    isSetupComplete: false,
                    _hasHydrated: true // Importante: sigue hidratado pero vacío
                });
            },

            // 💣💣 Nivel 2: Reset Duro (memoria + localStorage)
            hardReset: () => {
                return new Promise<void>((resolve) => {
                    console.log("💥 Reset duro: memoria + localStorage");

                    // 1. Marcar inicio de reset
                    set({
                        _isResetting: true,
                        _resetTimestamp: Date.now()
                    });

                    // 2. Limpiar estado en memoria (sincrónico)
                    set({
                        tournamentId: null,
                        hostName: "",
                        pairs: {},
                        pairUuidMap: {}, // 🧹 V4.2.1 Fix: Clear Map
                        matchHistory: [],
                        liveScores: {}, // 🔴 Clear Live
                        isSetupComplete: false,
                        _hasHydrated: true // Forzar como hidratado
                    });

                    // 3. Esperar al siguiente ciclo de evento
                    setTimeout(() => {
                        // 4. Eliminar del localStorage
                        if (typeof window !== 'undefined') {
                            localStorage.removeItem('pitomate-storage-v2');
                        }

                        // 5. Marcar como completado
                        set({ _isResetting: false });
                        resolve();
                    }, 50); // Pequeño delay para asegurar orden
                });
            },

            // 💣💣💣 Nivel 3: Reset Nuclear (TODO + recarga)
            nuclearReset: async () => {
                console.log("☢️ RESET NUCLEAR: Destruyendo todo...");

                // 1. Marcar inicio
                set({
                    _isResetting: true,
                    _resetTimestamp: Date.now()
                });

                // 2. Destruir estado en memoria
                set({
                    tournamentId: null,
                    hostName: "",
                    pairs: {},
                    pairUuidMap: {}, // 🧹 V4.2.1 Fix: Clear Map
                    matchHistory: [],
                    liveScores: {}, // 🔴 Clear Live
                    isSetupComplete: false,
                    _hasHydrated: false // CRÍTICO: NO está hidratado
                });

                // 3. Estrategia: Escribir estado "muerto" primero
                if (typeof window !== 'undefined') {
                    const deadState = {
                        state: {
                            tournamentId: null,
                            hostName: "",
                            pairs: {},
                            pairUuidMap: {}, // 🧹 V4.2.1 Fix: Clear Map
                            matchHistory: [],
                            liveScores: {},
                            isSetupComplete: false,
                            _hasHydrated: true, // Forzar hidratación "vacía"
                            _isResetting: false,
                            _resetTimestamp: Date.now()
                        },
                        version: 0
                    };

                    // Sobrescribir con estado muerto
                    localStorage.setItem('pitomate-storage-v2', JSON.stringify(deadState));

                    // Esperar a que se escriba
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Ahora eliminar
                    localStorage.removeItem('pitomate-storage-v2');

                    // 4. Limpiar cachés de Next.js
                    if ('caches' in window) {
                        try {
                            const cacheNames = await caches.keys();
                            await Promise.all(
                                cacheNames.map(name => caches.delete(name))
                            );
                        } catch (e) {
                            console.warn("No se pudieron limpiar caches:", e);
                        }
                    }

                    // 5. Limpiar sessionStorage
                    sessionStorage.clear();
                }

                // 0. RESET REMOTO (DEACTIVATE TOURNAMENT)
                // Importamos dinámicamente para no crear ciclo
                import('./tournamentService').then(async ({ deactivateTournament }) => {
                    await deactivateTournament();

                    // 6. Recarga con parámetro anti-caché
                    const reloadUrl = `${window.location.origin}/?reset_nuclear=${Date.now()}`;
                    window.location.href = reloadUrl;
                });
            },

            // Para compatibilidad con código antiguo
            clearTournament: () => {
                get().hardReset();
            },

            getPairNames: (pairId) => {
                const state = get();
                return state.pairs[pairId.toString()] || ["Desconocido", "Desconocido"];
            }
        }),
        {
            name: 'pitomate-storage-v2',
            storage: createJSONStorage(() => localStorage),

            // 🛡️ Callback CRÍTICO: Se ejecuta después de hidratar
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Zustand acaba de hidratar desde localStorage
                    console.log("🔄 Zustand hidratado desde localStorage");

                    // Verificar si estamos en medio de un reset
                    if (state._isResetting) {
                        console.warn("⚠️ Hidratando durante reset - ignorando datos");
                        // Ignorar datos hidratados, mantener estado vacío
                        state.softReset();
                    }

                    // Marcar como hidratado
                    state.markAsHydrated();
                }
            },

            // 🛡️ Sanitizar: Qué campos persistir
            partialize: (state) => ({
                // Solo persistir estos campos
                tournamentId: state.tournamentId,
                hostName: state.hostName,
                pairs: state.pairs,
                pairUuidMap: state.pairUuidMap, // 🗺️ V4.1 Fix: Persist Map!
                matchHistory: state.matchHistory,
                liveScores: state.liveScores, // 🔴 V4.5 Persist Live Scores
                isSetupComplete: state.isSetupComplete,
                // NO persistir estados de control (_hasHydrated, _isResetting)
            }),
        }
    )
);

/**
 * 🛡️ HOOK DE SEGURIDAD: Previene uso de datos no hidratados
 */
export const useSafeTournamentStore = () => {
    const store = useTournamentStore();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Solo considerar listo después de la hidratación
        // Y si no estamos en medio de un reset
        if (store._hasHydrated && !store._isResetting) {
            setIsReady(true);
        }
    }, [store._hasHydrated, store._isResetting]);

    return {
        ...store,
        isReady,
        // Valores seguros (solo cuando isReady = true)
        safeTournamentId: isReady ? store.tournamentId : null,
        safePairs: isReady ? store.pairs : {},
        safeMatchHistory: isReady ? store.matchHistory : [],
        safeIsSetupComplete: isReady ? store.isSetupComplete : false,
    };
};
