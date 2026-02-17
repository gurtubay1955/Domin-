
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ MISSING AUTH KEYS");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CONFIGURATION (Hardcoded for testing based on logs)
const TID = "1644c1d8-2ab8-4ab6-8841-fc533718e001"; // The active tournament ID from previous logs
const PAIR_A_ID = "00000000-0000-0000-0000-000000000001"; // Placeholder UUIDs if we don't have real ones
const PAIR_B_ID = "00000000-0000-0000-0000-000000000002"; // We need valid UUIDs ideally, but for event testing invalid ones might error in FK constraint

// Wait! We need valid Pair UUIDs or the INSERT will fail FK constraint.
// Let's first fetch the pairs for the tournament to get real UUIDs.

async function run() {
    console.log("🎬 SIMULATING MATCH COMPLETION...");

    // 1. Get Pairs
    const { data: pairs, error: pError } = await supabase
        .from('pairs')
        .select('*')
        .eq('tournament_id', TID);

    if (pError || !pairs || pairs.length < 2) {
        console.error("❌ COULD NOT FETCH PAIRS:", pError);
        return;
    }

    const p1 = pairs[0];
    const p2 = pairs[1];

    console.log(`🔹 Using Pairs: ${p1.pair_number} (${p1.id}) vs ${p2.pair_number} (${p2.id})`);

    // 2. Insert Match
    const matchId = crypto.randomUUID();

    const { error } = await supabase
        .from('matches')
        .insert({
            id: matchId,
            tournament_id: TID,
            pair_a_id: p1.id,
            pair_b_id: p2.id,
            score_a: 100,
            score_b: 90,
            hands_a: 4,
            hands_b: 3,
            termination_type: 'none',
            timestamp: Date.now(),
            pair_a_names: [p1.player1_name, p1.player2_name],
            pair_b_names: [p2.player1_name, p2.player2_name]
        });

    if (error) {
        console.error("❌ SIM ERROR:", error);
    } else {
        console.log(`✅ MATCH FINISHED SENT: ${p1.pair_number} vs ${p2.pair_number} (100-90)`);
        console.log(`🆔 Match ID: ${matchId}`);
    }
}

run();
