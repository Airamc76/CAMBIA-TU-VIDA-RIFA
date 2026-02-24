import { supabase, supabasePublic, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase';
import { Raffle } from '../types';
import { handleDBError } from './dbHelpers';

export const raffleRepository = {
    async getRaffles() {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Configuración de Supabase incompleta.');
        }

        const queryPromise = supabasePublic
            .from('raffles')
            .select('*')
            .neq('status', 'deleted')
            .order('created_at', { ascending: false });

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout cargando rifas. Verifica conexión a Supabase.')), 15000)
        );

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        if (error) handleDBError(error, 'getRaffles');

        return (data || []) as Raffle[];
    },

    async saveRaffle(raffle: Raffle) {
        const { data, error } = await supabase.rpc('save_raffle', { p_raffle: raffle });
        if (error) handleDBError(error, 'saveRaffle (RPC)');
        return data;
    },

    async deleteRaffle(id: string) {
        const { error } = await supabase.from('raffles').update({ status: 'deleted' }).eq('id', id);
        if (error) throw error;
    },

    async uploadRaffleImage(file: File) {
        const path = `raffles/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from('comprobantes').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('comprobantes').getPublicUrl(path);
        return data.publicUrl;
    }
};
