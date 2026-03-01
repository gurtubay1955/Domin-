require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function getNames() {
    const { data } = await supabase.from('players').select('name').eq('is_active', true);
    console.log(data ? data.map(p => p.name).join(', ') : "Ninguno");
}
getNames();
