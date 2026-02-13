
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing environment variables. Check .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMatches() {
    console.log("🔍 DIAGNOSIS V4.1: Checking Matches Table...");

    // 1. Get Active Tournament (to have a valid ID)
    const { data: config } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', 'global_config')
        .single();

    const tournamentId = config?.value?.active_tournament_id;

    if (!tournamentId) {
        console.error("❌ No active tournament found in app_state.");
        return;
    }

    console.log(`📂 Active Tournament ID: ${tournamentId}`);

    // 2. Setup Realtime Listener BEFORE inserting
    console.log("👂 Listening for INSERT on 'matches'...");
    const channel = supabase.channel('diagnosis_channel')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
            (payload) => {
                console.log("✅ REALTIME SUCCESS! Received Match Event:", payload.new.id);
            }
        )
        .subscribe((status) => {
            console.log("📡 Subscription Status:", status);
        });

    // 3. Insert Dummy Pairs (if needed)
    console.log("👥 Checking/Seeding Pairs...");
    let { data: pairs } = await supabase.from('pairs').select('id, pair_number').eq('tournament_id', tournamentId);

    if (!pairs || pairs.length < 2) {
        console.log("⚠️ Seeding 2 Dummy Pairs...");
        const p1 = { tournament_id: tournamentId, pair_number: 1, player1_name: 'TestA', player2_name: 'TestB' };
        const p2 = { tournament_id: tournamentId, pair_number: 2, player1_name: 'TestC', player2_name: 'TestD' };

        await supabase.from('pairs').insert([p1, p2]);
        // Re-fetch
        const res = await supabase.from('pairs').select('id, pair_number').eq('tournament_id', tournamentId);
        pairs = res.data;
    }

    if (!pairs || pairs.length < 2) {
        console.error("❌ Failed to seed pairs. Aborting.");
        return;
    }

    // 4. Insert Dummy Match
    const dummyId = require('crypto').randomUUID();
    console.log(`📝 Inserting Dummy Match: ${dummyId}...`);

    const { error } = await supabase.from('matches').insert({
        id: dummyId,
        tournament_id: tournamentId,
        pair_a_id: pairs[0].id,
        pair_b_id: pairs[1].id,
        score_a: 10,
        score_b: 0,
        hands_a: 1,
        hands_b: 0,
        termination_type: 'none',
        timestamp: Date.now()
    });

    if (error) {
        console.error("❌ INSERT FAILED (RLS Issue?):", error.message);
    } else {
        console.log("✅ INSERT SUCCESS. Waiting for Realtime event...");
    }

    // Keep alive for 10 seconds to hear event
    setTimeout(async () => {
        console.log("🧹 Cleaning up dummy match...");
        await supabase.from('matches').delete().eq('id', dummyId);
        process.exit(0);
    }, 5000);
}

testMatches();
