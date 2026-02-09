import { createClient } from '@supabase/supabase-js';

// Credenciales oficiales del proyecto CambiatuvidaConDavid
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * CLIENTE ADMIN: Para login de staff y gestión de rifas.
 * Mantiene la sesión activa en el navegador.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * CLIENTE PÚBLICO (PRO): Para compras y consultas anónimas.
 * Configurado para ignorar cualquier sesión persistente.
 * Garantiza que la petición viaje SIEMPRE como rol 'anon'.
 */
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('raffles').select('count', { count: 'exact', head: true });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase connection failed:', err);
    return false;
  }
};