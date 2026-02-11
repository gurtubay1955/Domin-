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
}

interface TournamentState {
    // Estados principales
    tournamentId: string | null;
    hostName: string;
    pairs: Record<string, string[]>;
    matchHistory: MatchRecord[];
    isSetupComplete: boolean;

    // 🔮 ESTADOS DE CONTROL ANTI-ZOMBIE
    _hasHydrated: boolean;          // ¿Ya se hidrató desde localStorage?
    _isResetting: boolean;          // ¿Estamos en medio de un reset?
    _resetTimestamp: number | null; // Cuándo fue el último reset

    // Acciones principales
    initializeTournament: (id: string, host: string, pairs: Record<string, string[]>) => void;
    addMatch: (match: MatchRecord) => void;
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
            matchHistory: [],
            isSetupComplete: false,

            // Estados de control iniciales
            _hasHydrated: false,
            _isResetting: false,
            _resetTimestamp: null,

            // Acciones principales
            initializeTournament: (id, host, pairs) => {
                console.log("🌀 STORE: Inicializando torneo...", id);
                set({
                    tournamentId: id,
                    hostName: host,
                    pairs: pairs,
                    matchHistory: [],
                    isSetupComplete: true,
                    _hasHydrated: true // Marcar como hidratado
                });
            },

            addMatch: (match) => {
                set((state) => {
                    // Prevenir duplicados
                    const exists = state.matchHistory.some(m => m.id === match.id);
                    if (exists) return state;
                    return { matchHistory: [...state.matchHistory, match] };
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
                    matchHistory: [],
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
                        matchHistory: [],
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
                    matchHistory: [],
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
                            matchHistory: [],
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

                // 6. Recarga con parámetro anti-caché
                const reloadUrl = `${window.location.origin}/?reset_nuclear=${Date.now()}`;
                window.location.href = reloadUrl;
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
                matchHistory: state.matchHistory,
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
