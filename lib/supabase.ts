import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

// Credenciales oficiales del proyecto CambiatuvidaConDavid
export const SUPABASE_URL = ENV.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY;

/**
 * CLIENTE ADMIN: Para login de staff y gestión de rifas.
 * Mantiene la sesión activa en el navegador.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * CLIENTE PÚBLICO (PRO): Para compras y consultas anónimas.
 * Garantiza que la petición viaje SIEMPRE como rol 'anon'.
 */
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

/**
 * CLIENTE ADMIN (SERVICE ROLE): Solo para gestión de usuarios.
 * Requiere VITE_SUPABASE_SERVICE_ROLE_KEY en .env.local
 */
const SERVICE_ROLE = ENV.VITE_SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  : null;

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