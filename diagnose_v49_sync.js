// Diagnostic script for V4.9 opponent selection sync
// Paste this in the browser console (F12) on the table-select page

console.log("🔍 V4.9 DIAGNOSTIC SCRIPT");
console.log("========================");

// 1. Check current state
const store = window.localStorage.getItem('tournament-storage');
if (store) {
    const parsed = JSON.parse(store);
    console.log("📦 Store state:", {
        tournamentId: parsed.state?.tournamentId,
        isSetupComplete: parsed.state?.isSetupComplete,
        pairs: parsed.state?.pairs,
        liveMatches: parsed.state?.liveMatches
    });
}

// 2. Check session
const user = window.sessionStorage.getItem('currentUser');
const match = window.sessionStorage.getItem('activeMatch');
console.log("👤 Current user:", user);
console.log("🎮 Active match:", match);

// 3. Monitor handleStartMatch
console.log("\n🎯 To test, click '¡A LA MESA!' and watch for:");
console.log("  - '✅ V4.8: Opponents marked as SEATED'");
console.log("  - Any error messages");

// 4. Check if live_matches subscription is active
console.log("\n📡 Checking Supabase channels...");
setTimeout(() => {
    console.log("Active channels:", window.supabase?.getChannels?.());
}, 1000);
