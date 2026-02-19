
import { createClient } from '@supabase/supabase-js';

// Las variables se cargan vía --env-file desde la terminal
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Variables de entorno no detectadas.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupRaffles() {
    console.log('🔍 Buscando rifas de prueba...');

    const { data: testRaffles, error: searchError } = await supabase
        .from('raffles')
        .select('id, title, status')
        .ilike('title', '%Test%');

    if (searchError) {
        console.error('❌ Error buscando rifas:', searchError);
        return;
    }

    if (!testRaffles || testRaffles.length === 0) {
        console.log('✅ No se encontraron rifas de prueba.');
        return;
    }

    console.log(`📝 Se encontraron ${testRaffles.length} rifas de prueba:`);
    testRaffles.forEach(r => console.log(`   - [${r.id}] ${r.title} (${r.status})`));

    const idsToUpdate = testRaffles.map(r => r.id);

    console.log('\n🚀 Actualizando estado a "deleted"...');

    const { error: updateError } = await supabase
        .from('raffles')
        .update({ status: 'deleted' })
        .in('id', idsToUpdate);

    if (updateError) {
        console.error('❌ Error actualizando rifas:', updateError);
    } else {
        console.log('✨ ¡Limpieza completada con éxito!');
    }
}

cleanupRaffles();
