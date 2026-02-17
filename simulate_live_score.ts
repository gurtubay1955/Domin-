
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TID = '1644c1d8-2ab8-4ab6-8841-fc533718e001';

async function updateLive() {
    console.log("🔴 SIMULATING LIVE SCORE UPDATE...");

    // Pairs from previous reproduction: 1 and 2
    const PAIR_A = 1;
    const PAIR_B = 2;

    const { error } = await supabase
        .from('live_matches')
        .upsert({
            tournament_id: TID,
            pair_a: PAIR_A,
            pair_b: PAIR_B,
            score_a: 25,
            score_b: 18,
            hand_number: 3,
            last_updated: new Date().toISOString()
        });

    if (error) console.error("❌ SIM ERROR:", error);
    else console.log("✅ LIVE SCORE SENT: 25 - 18");
}

updateLive();
