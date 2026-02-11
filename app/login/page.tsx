"use client";

/**
 * @file app/login/page.tsx
 * @description Player Login Screen.
 * @author Antigravity (Google Deepmind)
 * 
 * MAIN RESPONSIBILITIES:
 * 1. Authenticate players using a simple PIN (1234).
 * 2. FILTER: Only show players that are actually assigned to a pair in the current tournament.
 * 3. GUARD: Redirect to Home if no tournament is configured.
 * 4. STATE: Uses Zustand Store for setup verification.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";
import { useTournamentStore } from "@/lib/store"; // Quantum Store

export default function LoginPage() {
    const router = useRouter();
    const [selectedUser, setSelectedUser] = useState("");
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");

    // QUANTUM UPGRADE: Connect to Store
    const { isSetupComplete, pairs } = useTournamentStore();

    /**
     * EFFECT: Security Guard
     * Prevents users from manually accessing /login if the host hasn't set up the pairs.
     * NOW USES: Store State instead of raw LocalStorage
     */
    useEffect(() => {
        // Hydration check (store might take a ms to load from stickyness)
        const checkAccess = () => {
            const hasPairs = Object.keys(pairs).length > 0;
            // STRICT CHECK: Flag must be true AND pairs must exist
            if (!isSetupComplete || !hasPairs) {
                router.push("/");
            }
        };
        checkAccess();
    }, [isSetupComplete, pairs, router]);

    /**
     * handleLogin
     * Validates credentials and sets the session.
     */
    const handleLogin = () => {
        // Validation: User must select a name.
        if (!selectedUser) {
            setError("Selecciona tu nombre");
            return;
        }
        // Validation: PIN must be 4 digits.
        if (pin.length < 4) {
            setError("El PIN debe ser de 4 dígitos");
            return;
        }

        // Validation: Real PIN
        const CORRECT_PIN = "1234";

        if (pin !== CORRECT_PIN) {
            setError("PIN Incorrecto. Intenta con 1234");
            setPin(""); // Clear for retry
            return;
        }

        // SESSION SET: We keep using sessionStorage for the "Session" concept
        // (This differentiates "Who I am in this tab" from "The Tournament State")
        sessionStorage.setItem("currentUser", selectedUser);

        // REDIRECT: Go to the "Table Selection" (Lobby).
        router.push("/table-select");
    };

    // Extract all player names from the pairs object for the dropdown
    const allPlayers = Object.values(pairs).flat();

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#5e4b41] via-[#4A3B32] to-[#2d241f] text-[#FDFBF7] font-hand flex items-center justify-center p-4">

            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-black/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative bg-white/10 p-8 md:p-12 rounded-3xl backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] w-full max-w-sm mx-auto transform transition-all hover:scale-[1.01] duration-500">

                <div className="text-center mb-10 space-y-2">
                    <div className="inline-flex p-4 bg-white/10 rounded-full mb-4 shadow-inner ring-1 ring-white/20">
                        <Lock size={32} className="text-[#A5D6A7]" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight drop-shadow-md">Bienvenido</h1>
                    <p className="opacity-60 text-sm uppercase tracking-widest">3er Torneo del Pitomate</p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2 group">
                        <label className="text-sm font-bold opacity-70 ml-1 group-focus-within:text-[#A5D6A7] transition-colors">JUGADOR</label>
                        <div className="relative">
                            <select
                                value={selectedUser}
                                onChange={(e) => {
                                    setSelectedUser(e.target.value);
                                    setError("");
                                }}
                                className="w-full bg-black/20 text-[#FDFBF7] p-4 pl-12 rounded-xl text-lg font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#A5D6A7] focus:bg-black/30 transition-all hover:bg-black/30"
                            >
                                <option value="">Selecciona tu nombre...</option>
                                {allPlayers.sort().map((p) => (
                                    <option key={p} value={p} className="text-black">{p}</option>
                                ))}
                            </select>
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={20} />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none text-xs">▼</div>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className="text-sm font-bold opacity-70 ml-1 group-focus-within:text-[#A5D6A7] transition-colors">PIN DE ACCESO</label>
                        <div className="relative">
                            <input
                                type="password"
                                maxLength={4}
                                placeholder="• • • •"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full bg-black/20 text-[#FDFBF7] p-4 text-center text-3xl font-bold tracking-[1em] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A5D6A7] focus:bg-black/30 transition-all placeholder:text-white/10"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-[#EF5350]/20 border border-[#EF5350]/50 p-3 rounded-lg text-center animate-shake">
                            <p className="text-[#EF9A9A] text-sm font-bold">{error}</p>
                        </div>
                    )}

                    <button
                        onClick={handleLogin}
                        disabled={!selectedUser || pin.length < 4}
                        className={`
                w-full py-4 mt-4 text-xl font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all duration-300
                ${(!selectedUser || pin.length < 4)
                                ? "bg-white/5 text-white/20 cursor-not-allowed"
                                : "bg-[#A5D6A7] text-[#1B5E20] hover:bg-[#81C784] hover:shadow-[#A5D6A7]/20 hover:-translate-y-1 active:scale-95"}
            `}
                    >
                        <span>Ingresar al Torneo</span>
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs opacity-30">Pide tu PIN al anfitrión si lo olvidaste.</p>
                </div>

            </div>
        </div>
    );
}
