
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const baseScores = [
    { name: "Rodrigo", base_points: 17, base_diff: 0 },
    { name: "Rodolfo", base_points: 16, base_diff: 0 },
    { name: "Carlos R", base_points: 16, base_diff: 0 },
    { name: "Buru", base_points: 15, base_diff: 0 },
    { name: "Rudy", base_points: 15, base_diff: 0 },
    { name: "Mike", base_points: 15, base_diff: 0 },
    { name: "J Miguel", base_points: 14, base_diff: 0 },
    { name: "Beto", base_points: 13, base_diff: 0 },
    { name: "Mayito", base_points: 11, base_diff: 0 },
    { name: "Edgar", base_points: 11, base_diff: 0 },
    { name: "Germán", base_points: 8, base_diff: 0 },
    { name: "Alex", base_points: 8, base_diff: 0 },
    { name: "Paco", base_points: 7, base_diff: 0 },
    { name: "Rubén", base_points: 6, base_diff: 0 },
    { name: "Juan C", base_points: 6, base_diff: 0 },
    { name: "Rodrigo Jr", base_points: 4, base_diff: 0 }
];

async function seed() {
    console.log("🚀 Iniciando carga de Puntos Base (Historial al 26 Feb)...");

    for (const player of baseScores) {
        const { error } = await supabase
            .from('players')
            .upsert({
                name: player.name,
                base_points: player.base_points,
                base_diff: player.base_diff
            }, { onConflict: 'name' });

        if (error) {
            console.error(`❌ Error con ${player.name}:`, error.message);
        } else {
            console.log(`✅ ${player.name}: ${player.base_points} pts base cargados.`);
        }
    }

    console.log("🏁 Carga finalizada.");
}

seed();
