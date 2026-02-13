
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Load Environment Variables manually (no dotenv dependency needed if we parse)
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        if (!fs.existsSync(envPath)) return null;

        const content = fs.readFileSync(envPath, 'utf8');
        const env = {};
        content.split('\n').forEach(line => {
            const [key, val] = line.split('=');
            if (key && val) env[key.trim()] = val.trim();
        });
        return env;
    } catch (e) {
        return null;
    }
}

const env = loadEnv();
if (!env || !env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("❌ ERROR: Could not load .env.local or missing keys.");
    process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function diagnose() {
    console.log("🔍 DIAGNOSING SUPABASE CONNECTIVITY...");
    console.log(`📡 URL: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log("----------------------------------------");

    // TEST 1: READ app_state
    console.log("1️⃣  TEST READ (app_state)...");
    const { data: readData, error: readError } = await supabase
        .from('app_state')
        .select('*');

    if (readError) {
        console.error("❌ READ FAILED:", readError.message);
    } else {
        console.log("✅ READ SUCCESS. Rows found:", readData.length);
        console.log("   DATA:", JSON.stringify(readData, null, 2));
    }

    // TEST 2: WRITE app_state (Insert/Upsert)
    console.log("\n2️⃣  TEST WRITE (app_state)...");
    const testId = "TEST-DIAGNOSTIC-" + Date.now();
    const { error: writeError } = await supabase
        .from('app_state')
        .upsert({
            key: 'diagnostic_test',
            value: { status: 'ok', id: testId },
            updated_at: new Date().toISOString()
        });

    if (writeError) {
        console.error("❌ WRITE FAILED:", writeError.message);
    } else {
        console.log("✅ WRITE SUCCESS. Row inserted.");

        // CLEANUP
        console.log("   Cleaning up test row...");
        await supabase.from('app_state').delete().eq('key', 'diagnostic_test');
    }

    console.log("\n----------------------------------------");
    console.log("🏁 DIAGNOSIS COMPLETE");
}

diagnose();
