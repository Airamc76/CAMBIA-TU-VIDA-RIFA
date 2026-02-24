import { supabase, supabasePublic, supabaseAdmin } from '../lib/supabase';
import { AdminRole } from '../types';
import { AppError } from '../utils/errors';

export const normalizeDni = (dni: string) => String(dni || '').replace(/\D/g, '');
export const normalizeEmail = (email: string) => String(email || '').trim().toLowerCase();

export const handleDBError = (error: any, context: string) => {
    console.error(`❌ ERROR EN ${context.toUpperCase()}:`, error);
    const msg = error?.message || 'Error desconocido en la base de datos';
    const details = error?.details || error?.hint || null;
    throw new AppError(msg, 'DB_ERROR', true, details);
};
