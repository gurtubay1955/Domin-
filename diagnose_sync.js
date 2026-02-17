/**
 * Script de diagnóstico para verificar sincronización en tiempo real
 * Ejecutar en la consola del navegador (F12)
 */

console.log('🔍 DIAGNÓSTICO DE SINCRONIZACIÓN V4.8');
console.log('=====================================\n');

// 1. Verificar si hay tournamentId en el store
const checkStore = () => {
    const storeData = localStorage.getItem('pitomate-storage-v2');
    if (!storeData) {
        console.error('❌ NO HAY DATOS EN STORE');
        return null;
    }

    const parsed = JSON.parse(storeData);
    console.log('✅ Store encontrado:');
    console.log('  - Tournament ID:', parsed.state.tournamentId);
    console.log('  - Host:', parsed.state.hostName);
    console.log('  - Parejas configuradas:', Object.keys(parsed.state.pairs).length);
    console.log('  - Partidas en historial:', parsed.state.matchHistory?.length || 0);
    console.log('  - Live matches:', Object.keys(parsed.state.liveScores || {}).length);

    return parsed.state.tournamentId;
};

const tournamentId = checkStore();

if (!tournamentId) {
    console.error('⛔ No se puede continuar sin tournament ID');
} else {
    console.log('\n🔍 Verificando live_matches en Supabase...');
    console.log('Ejecuta esto en el Editor SQL de Supabase:\n');
    console.log(`SELECT * FROM live_matches WHERE tournament_id = '${tournamentId}';`);
    console.log('\nSi está vacío, significa que:');
    console.log('1. No se ejecutó el SQL de permisos real-time');
    console.log('2. O la función updateLiveMatch() falló');

    console.log('\n🔍 Verificando suscripción real-time...');
    console.log('Busca en los logs de consola:');
    console.log('  - "📡 Subscribing to LIVE matches"');
    console.log('  - "✅ V4.8: Opponents marked as SEATED"');
    console.log('  - "🔥 LIVE UPDATE:"');
}
