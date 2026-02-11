import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * @file lib/store.ts
 * @description Centralized State Management (The "Brain" of the App).
 * @author Antigravity (Google Deepmind)
 * 
 * REPLACES: Scattered localStorage calls.
 * POWERED BY: Zustand + Persistence Middleware.
 */

// DOMAIN TYPES
export interface MatchRecord {
    id: string; // Unique ID (timestamp + pairs)
    tournamentId: string;
    myPair: number;
    oppPair: number;
    scoreMy: number;
    scoreOpp: number;
    oppNames: string[];
    timestamp: number;
}

interface TournamentState {
    // STATE
    tournamentId: string | null;
    hostName: string;
    pairs: Record<string, string[]>; // "1": ["Rudy", "Mike"]
    matchHistory: MatchRecord[];
    isSetupComplete: boolean;

    // ACTIONS
    initializeTournament: (id: string, host: string, pairs: Record<string, string[]>) => void;
    addMatch: (match: MatchRecord) => void;
    clearTournament: () => void;

    // COMPUTED (Selectors can be derived in components, but helpers are nice)
    getPairNames: (pairId: number) => string[];
}

export const useTournamentStore = create<TournamentState>()(
    persist(
        (set, get) => ({
            // INITIAL STATE
            tournamentId: null,
            hostName: "",
            pairs: {},
            matchHistory: [],
            isSetupComplete: false,

            // ACTIONS
            initializeTournament: (id, host, pairs) => {
                console.log("🌀 STORE: Initializing Tournament...", id);
                set({
                    tournamentId: id,
                    hostName: host,
                    pairs: pairs,
                    matchHistory: [],
                    isSetupComplete: true
                });
            },

            addMatch: (match) => {
                console.log("📝 STORE: Adding Match...", match.id);
                set((state) => {
                    // Safety Deduplication (in case UI guard fails)
                    const exists = state.matchHistory.some(m => m.id === match.id);
                    if (exists) return state;

                    return {
                        matchHistory: [...state.matchHistory, match]
                    };
                });
            },

            clearTournament: () => {
                console.log("💥 STORE: NUKING TOURNAMENT DATA");
                set({
                    tournamentId: null,
                    hostName: "",
                    pairs: {},
                    matchHistory: [],
                    isSetupComplete: false
                });
            },

            // HELPERS
            getPairNames: (pairId) => {
                const state = get();
                return state.pairs[pairId.toString()] || ["Desconocido", "Desconocido"];
            }
        }),
        {
            name: 'pitomate-storage-v1', // Unique name for localStorage key
            storage: createJSONStorage(() => localStorage), // Explicitly use localStorage
        }
    )
);
