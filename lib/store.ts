// ============================================================
// BLOQUE 1: IMPORTS
// ============================================================
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

// ============================================================
// BLOQUE 2: INTERFACES Y TIPOS DEL STORE
// ============================================================

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
    scorekeeper?: string; // V8.3 Soft-Lock 
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

    // ============================================================
    // Acciones principales (Se implementan en Bloque 3 y 4)
    // ============================================================
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

            // ============================================================
            // BLOQUE 3: ESTADO INICIAL Y ACCIONES PRINCIPALES
            // ============================================================

            // FUNCIÓN: initializeTournament
            // PROPÓSITO: Establece el estado inicial del torneo y marca como completado el setup.
            // RECIBE: id, host, pairs, existingMatches, pairUuidMap
            // RETORNA: void
            // DEPENDE DE: Zustand set()
            // LLAMADA POR: UI (Setup Finalization) y GlobalSync (Hydration)
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

            // FUNCIÓN: addMatch
            // PROPÓSITO: Registra una partida completada localmente previniendo duplicados y limpiando live.
            // RECIBE: match
            // RETORNA: void
            // DEPENDE DE: Zustand set(), state.matchHistory, state.liveScores
            // LLAMADA POR: UI (Game board cuando termina partida)
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

            // FUNCIÓN: syncMatch
            // PROPÓSITO: Recibe una partida completada desde realtime subscription y limpia live scores de esa mesa.
            // RECIBE: match
            // RETORNA: void
            // DEPENDE DE: Zustand set(), state.matchHistory, state.liveScores
            // LLAMADA POR: GlobalSync (Realtime Insert Event)
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

            // FUNCIÓN: syncMatches
            // PROPÓSITO: Recibe lotes de partidas (polling fallback) evitando duplicados.
            // RECIBE: matches
            // RETORNA: void
            // DEPENDE DE: Zustand set(), state.matchHistory, state.liveScores
            // LLAMADA POR: GlobalSync (Polling Loop cada 5s)
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

            // FUNCIÓN: getPairNames
            // PROPÓSITO: Obtiene los nombres de los jugadores de una pareja.
            // RECIBE: pairId (número de pareja)
            // RETORNA: string[]
            // DEPENDE DE: Zustand get(), state.pairs
            // LLAMADA POR: Múltiples componentes UI (Leaderboard, Game)
            getPairNames: (pairId) => {
                const state = get();
                return state.pairs[pairId.toString()] || ["Desconocido", "Desconocido"];
            },

            // ============================================================
            // BLOQUE 4: SINCRONIZACIÓN DE MARCADORES EN VIVO
            // ============================================================

            // FUNCIÓN: syncLiveMatch
            // PROPÓSITO: Actualiza un marcador en vivo proveniente de la nube si la partida no está ya en historial.
            // RECIBE: data (LiveMatchData)
            // RETORNA: void
            // DEPENDE DE: Zustand set(), state.liveScores, state.matchHistory
            // LLAMADA POR: GlobalSync (Realtime Update Event)
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

            // FUNCIÓN: removeLiveScore
            // PROPÓSITO: Elimina del local un marcador en vivo específico con llave de pares ordenada.
            // RECIBE: pairA, pairB
            // RETORNA: void
            // DEPENDE DE: Zustand set(), state.liveScores
            // LLAMADA POR: GlobalSync (Realtime Delete Event)
            removeLiveScore: (pairA, pairB) => {
                set((state) => {
                    const key = `${pairA}-${pairB}`;
                    if (!state.liveScores[key]) return state; // No-op

                    console.log(`🗑️ STORE: Removing live match ${key}`);
                    const { [key]: _, ...rest } = state.liveScores;
                    return { liveScores: rest };
                });
            },

            // FUNCIÓN: setLiveScores
            // PROPÓSITO: Reemplaza toda la lista de marcadores (utilizado en el fallback de polling).
            // RECIBE: fullList (LiveMatchData[])
            // RETORNA: void
            // DEPENDE DE: Zustand set(), state.matchHistory
            // LLAMADA POR: GlobalSync (Polling Loop cada 2s)
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

            // ============================================================
            // BLOQUE 5: CONTROL ANTI-ZOMBIE (Estados de Control)
            // ============================================================

            // FUNCIÓN: markAsHydrated
            // PROPÓSITO: Establece la bandera _hasHydrated a true (listo para procesar datos local storage).
            // RECIBE: void
            // RETORNA: void
            // DEPENDE DE: Zustand set()
            // LLAMADA POR: Middleware onRehydrateStorage
            markAsHydrated: () => {
                set({ _hasHydrated: true });
            },

            // FUNCIÓN: beginReset
            // PROPÓSITO: Bandera para informar a la UI y middleware que se está realizando un delete masivo local.
            // RECIBE: void
            // RETORNA: void
            // DEPENDE DE: Zustand set()
            // LLAMADA POR: hardReset / nuclearReset
            beginReset: () => {
                set({ _isResetting: true, _resetTimestamp: Date.now() });
            },

            // FUNCIÓN: completeReset
            // PROPÓSITO: Baja la bandera cerrando la ventana de destrucción, habilitando estado de nuevo.
            // RECIBE: void
            // RETORNA: void
            // DEPENDE DE: Zustand set()
            // LLAMADA POR: finalización de Async reseters
            completeReset: () => {
                set({ _isResetting: false });
            },

            // ============================================================
            // BLOQUE 6: NIVELES DE RESET
            // ============================================================

            // FUNCIÓN: softReset
            // PROPÓSITO: Nivel 1 - Solo limpia la memoria de forma sincrónica. Mantiene hidratación on pero valores vacíos.
            // RECIBE: void
            // RETORNA: void
            // DEPENDE DE: Zustand set()
            // LLAMADA POR: Middleware onRehydrate si entra durante un _isResetting
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

            // FUNCIÓN: hardReset
            // PROPÓSITO: Nivel 2 - Limpia memoria, marca beginReset y vacía localStorage asíncronamente.
            // RECIBE: void
            // RETORNA: Promise<void>
            // DEPENDE DE: Window.localStorage, timeout
            // LLAMADA POR: clearTournament() en UI (Salidas voluntarias de torneo)
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

            // FUNCIÓN: nuclearReset
            // PROPÓSITO: Nivel 3 - Destruye memoria, inyecta localStorage zombie "muerto", limpia Caches (Service Workers PWA), SessionStorage y lanza desactivación remota. Termina forzando un reload real de la URL para invalidar caché de app de React.
            // RECIBE: void
            // RETORNA: Promise<void>
            // DEPENDE DE: Window, localStorage, caches, ServiceWorker, Supabase Network (deactivateTournament)
            // LLAMADA POR: Botón maestro The Big Red Button de Host.
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

            // FUNCIÓN: clearTournament
            // PROPÓSITO: Alias genérico para invocar un Hard Reset.
            // RECIBE: void
            // RETORNA: void
            // DEPENDE DE: Zustand get(), hardReset
            // LLAMADA POR: UI genérica
            clearTournament: () => {
                get().hardReset();
            },
        }),

        // ============================================================
        // BLOQUE 7: CONFIGURACIÓN PERSIST (Zustand Middleware)
        // ============================================================
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

// ============================================================
// BLOQUE 8: HOOK DE SEGURIDAD EXTERNO
// ============================================================

/**
 * 🛡️ HOOK DE SEGURIDAD: Previene uso de datos no hidratados
 */
// FUNCIÓN: useSafeTournamentStore
// PROPÓSITO: Hook de wrapper de Zustand que bloquea UI si hay un hydratación pendiente o reset ocurriendo.
// RECIBE: void
// RETORNA: Object spreaded state + safe flags
// DEPENDE DE: useTournamentStore
// LLAMADA POR: Todos los Componentes principales de la UI para extracción de datos seguros
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
