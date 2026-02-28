"use client";

/**
 * @file app/game/page.tsx
 * @description The Container component for the Gameplay Screen.
 * @author Antigravity (Google Deepmind)
 * 
 * JOB:
 * 1. GUARD: Ensure tournament is running.
 * 2. GUARD: Ensure an active match session exists.
 * 3. HYDRATION: Read `activeMatch` from session and pass it to `ScoreBoard`.
 */

import { useEffect, useState } from "react";
import ScoreBoard from "@/components/game/ScoreBoard";
import { useRouter } from "next/navigation";
import { safeParse } from "@/lib/utils";
import { useTournamentStore } from "@/lib/store"; // FIXED: Missing import

export default function GamePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [matchConfig, setMatchConfig] = useState<any>(null);
    const [teamANames, setTeamANames] = useState(["Nosotros 1", "Nosotros 2"]);
    const [teamBNames, setTeamBNames] = useState(["Ellos 1", "Ellos 2"]);

    // QUANTUM UPGRADE: Connect to Store
    const { isSetupComplete, pairs } = useTournamentStore();

    /**
     * EFFECT: Init & Guards
     * This is the "Bouncer". If you're not on the list, you don't get in.
     */
    useEffect(() => {
        // 0. GUARD: Ensure tournament is configured
        // Must have setup flag AND pairs data.
        if (!isSetupComplete || Object.keys(pairs).length === 0) {
            console.warn("GamePage: Setup not complete. Redirecting to home.");
            router.push("/");
            return;
        }

        // 1. GUARD: Ensure an Active Match selected from Lobby
        // If user refreshes, we try to recover from sessionStorage.
        // If session is empty, they must go back to Lobby to re-select.
        const activeMatchStr = sessionStorage.getItem("activeMatch") || localStorage.getItem("activeMatch");
        if (!activeMatchStr) {
            router.push("/table-select");
            return;
        }

        // QUANTUM UPGRADE: safeParse
        const config = safeParse(activeMatchStr, null) as any;
        if (!config) {
            console.error("GamePage: Active match data corrupted.");
            router.push("/table-select");
            return;
        }

        setMatchConfig(config);

        // 2. Load Real Names
        // Map the pair IDs (e.g., 1 vs 5) to actual strings from Store
        if (pairs[config.myPair]) setTeamANames(pairs[config.myPair]);
        if (pairs[config.opponentPair]) setTeamBNames(pairs[config.opponentPair]);

        setLoading(false);
    }, [router, isSetupComplete, pairs]);

    if (loading) return (
        <div className="min-h-screen bg-[#2d241f] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#A5D6A7]"></div>
        </div>
    );

    return (
        <div className="w-full bg-[#4A3B32]">
            <ScoreBoard
                initialTeamA={teamANames}
                initialTeamB={teamBNames}
                pairIdA={matchConfig?.myPair}
                pairIdB={matchConfig?.opponentPair}
                isSpectator={matchConfig?.isSpectator || false}
            />
        </div>
    );
}
