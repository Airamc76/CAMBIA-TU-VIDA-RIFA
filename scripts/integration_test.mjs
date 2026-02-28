import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.staging' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function testLifecycle() {
    console.log('🧪 Iniciando prueba de ciclo de vida completo de Sorteos...\n');

    try {
        // 1. Crear Rifa Oculta
        console.log('[1/4] Creando rifa en estado OCULTA...');
        const fakeRaffle = {
            title: 'TEST-AUTO-RIFA',
            description: 'Test automation raffle',
            ticket_price: 10,
            total_tickets: 500,
            status: 'hidden',
            cover_url: 'test.jpg'
        };

        const { data: newRaffle, error: insertErr } = await supabaseAdmin
            .from('raffles')
            .insert([fakeRaffle])
            .select()
            .single();

        if (insertErr) throw insertErr;
        console.log(`✅ Rifa creada exitosamente con ID: ${newRaffle.id}`);

        // 2. Modificar Estado a Activa
        console.log('\n[2/4] Cambiando estado a ACTIVA...');
        const { error: updateErr } = await supabaseAdmin
            .from('raffles')
            .update({ status: 'active' })
            .eq('id', newRaffle.id);

        if (updateErr) throw updateErr;
        console.log(`✅ Estado actualizado a 'active' correctamente.`);

        // 3. Testear Borrado Físico/Lógico Bypasseando RLS (El fix que implementamos en el código via supabaseAdmin)
        console.log('\n[3/4] Ejecutando Borrado Lógico (Eliminada)...');
        const { count, error: delErr } = await supabaseAdmin
            .from('raffles')
            .update({ status: 'deleted' })
            .eq('id', newRaffle.id);

        if (delErr) throw delErr;

        const { data: deletedRaffle, error: checkErr } = await supabaseAdmin
            .from('raffles')
            .select('status')
            .eq('id', newRaffle.id)
            .single();

        if (deletedRaffle && deletedRaffle.status === 'deleted') {
            console.log(`✅ Borrado confirmado. Estado actual: ${deletedRaffle.status}`);
        } else {
            throw new Error("El borrado falló, el estado no es 'deleted'");
        }

        console.log('\n🎉 TODAS LAS PRUEBAS BACKEND SUPERADAS CON ÉXITO 🎉');

    } catch (e) {
        console.error('❌ ERROR EN LA PRUEBA:', e);
    }
}

testLifecycle();
