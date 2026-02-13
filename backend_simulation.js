
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("🤖 Backend Simulator: Waiting for new tournament...");

    let tournamentId = null;
    let attempts = 0;

    // 1. Wait for a new tournament (created in the last few seconds)
    while (!tournamentId && attempts < 60) { // Try for ~2 minutes (60 * 2s)
        const cutoff = new Date(Date.now() - 60000).toISOString(); // 1 min ago
        const { data } = await supabase
            .from('tournaments')
            .select('*')
            .gt('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            tournamentId = data[0].id;
            console.log(`✅ Detected New Tournament: ${tournamentId}`);
            console.log(`   Host: ${data[0].host_name}`);
        } else {
            process.stdout.write(".");
            await wait(2000);
            attempts++;
        }
    }

    if (!tournamentId) {
        console.log("\n❌ No tournament detected. Exiting.");
        process.exit(1);
    }

    // 2. Identify Pairs (Wait 5s for pairs to be registered)
    console.log("\n⏳ Waiting 5s for pairs to be registered...");
    await wait(5000);

    // We assume standard setup: 3 Pairs (1, 2, 3)
    // We will simulate Pair 1 vs Pair 2
    const pairA = 1;
    const pairB = 2;

    console.log(`\n🚀 STARTING SIMULATION: Pair ${pairA} vs Pair ${pairB}`);

    // 3. Live Match Loop (10 updates)
    for (let i = 1; i <= 10; i++) {
        const scoreA = i * 10;
        const scoreB = i * 5;
        const hand = i;

        console.log(`   📡 Broadcasting: Match ${pairA}-${pairB} | Score: ${scoreA}-${scoreB} | Hand: ${hand}`);

        const { error } = await supabase
            .from('live_matches')
            .upsert({
                tournament_id: tournamentId,
                pair_a: pairA,
                pair_b: pairB,
                score_a: scoreA,
                score_b: scoreB,
                hand_number: hand,
                last_updated: new Date().toISOString()
            });

        if (error) {
            console.error("   ❌ Update Failed:", error.message);
            if (error.code === '42P01') { // Table not found
                console.error("   🚨 FATAL: 'live_matches' table does not exist!");
                process.exit(1);
            }
        }

        await wait(2000); // 2s per hand
    }

    // 4. Finish Match
    console.log("🏁 Finishing Match...");

    // Delete Live Record
    await supabase.from('live_matches').delete().match({ tournament_id: tournamentId, pair_a: pairA, pair_b: pairB });

    // Insert Historical Record (Optional verification of sync)
    /*
    await supabase.from('matches').insert({
        tournament_id: tournamentId,
        pair_a_id: pairA, // Note: Schema might use ID or Num. Checking schema...
        pair_b_id: pairB, 
        score_a: 100, 
        score_b: 50,
        // ... assuming simplistic schema match
    });
    */

    console.log("✅ Simulation Complete. Backend Signing Off.");
}

main();
