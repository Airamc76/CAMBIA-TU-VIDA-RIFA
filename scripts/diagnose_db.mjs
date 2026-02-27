import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- DIAGNÓSTICO DE BASE DE DATOS ---');

    // 1. Verificar estados actuales
    const { data: raffles, error: rErr } = await supabase.from('raffles').select('id, title, status');
    if (rErr) {
        console.error('Error al obtener rifas:', rErr.message);
    } else {
        console.log('Rifas encontradas:', raffles.length);
        raffles.forEach(r => console.log(`- [${r.status}] ${r.title} (${r.id})`));
    }

    // 2. Intentar actualizar a 'deleted' (Prueba real)
    const sample = raffles?.find(r => r.status !== 'deleted');
    if (sample) {
        console.log(`\nProbando actualización a 'deleted' para: ${sample.title}...`);
        const { error: uErr } = await supabase
            .from('raffles')
            .update({ status: 'deleted' })
            .eq('id', sample.id);

        if (uErr) {
            console.error('❌ FALLÓ la actualización:', uErr.message);
            if (uErr.message.includes('check constraint')) {
                console.log('CONSEJO: Debes ejecutar el SQL de migración para permitir el estado "deleted".');
            }
        } else {
            console.log('✅ Actualización exitosa (al menos para el rol de servicio).');
        }
    }

    // 3. Verificar Webhook de correos
    console.log('\n--- VERIFICANDO WEBHOOKS ---');
    // Nota: Esto es limitado vía RPC, pero podemos intentar ver las tablas de settings
    const { data: settings, error: sErr } = await supabase.from('settings').select('*');
    if (sErr) {
        console.log('No se pudo leer tabla settings (puede que no exista).');
    } else {
        console.log('Configuración encontrada:', settings);
    }
}

diagnose();
