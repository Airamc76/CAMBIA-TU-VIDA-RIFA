import { supabase } from '../lib/supabase';
import { AdminRole } from '../types';
import { normalizeEmail } from './dbHelpers';

export const authRepository = {
    async login(email: string, pass: string) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: normalizeEmail(email),
            password: pass
        });
        if (authError) throw authError;

        const { data: role, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError || !role) {
            await supabase.auth.signOut();
            throw new Error('No autorizado.');
        }

        return { userId: authData.user.id, email: authData.user.email, role: role as AdminRole };
    },

    async signOut() {
        await supabase.auth.signOut();
    },

    async getMyRole() {
        const { data, error } = await supabase.rpc('get_my_role');
        if (error) throw error;
        return data as AdminRole;
    },

    async getAdminUsers() {
        const { data, error } = await supabase.rpc('get_admin_users');
        if (error) throw error;
        return data;
    },

    async createAdminUser(data: any) {
        throw new Error("Por razones de seguridad, la creación de usuarios administrativos desde el frontend ha sido deshabilitada. Usa el panel de Supabase o crea una Edge Function.");
    },

    async updateAdminUser(data: any) {
        if (data.role) {
            const { error } = await supabase.rpc('update_admin_role', {
                p_user_id: data.user_id,
                p_role: data.role
            });
            if (error) throw error;
        }
        if (data.password) {
            throw new Error("Por razones de seguridad, el reseteo de contraseñas de otros usuarios ha sido deshabilitado del frontend. Usa el panel de Supabase.");
        }
        return true;
    },

    async resetAdminMFA(userId: string) {
        const { error } = await supabase.rpc('reset_admin_mfa', { p_user_id: userId });
        if (error) throw error;
        return { message: "Seguridad 2FA reseteada. El usuario deberá configurar uno nuevo." };
    },

    async deleteAdminUser(userId: string) {
        throw new Error("Por razones de seguridad, la eliminación de usuarios desde el frontend ha sido deshabilitada. Usa el panel de Supabase.");
    }
};
