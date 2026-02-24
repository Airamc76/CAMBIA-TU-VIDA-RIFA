import { supabase, supabaseAdmin } from '../lib/supabase';
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
        if (!supabaseAdmin) {
            throw new Error("Configuración incompleta: Se requiere SERVICE_ROLE_KEY para crear usuarios.");
        }
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true
        });
        if (authErr) throw authErr;

        const { error: dbErr } = await supabaseAdmin.from('admins').insert({
            user_id: authUser.user.id,
            role: data.role
        });
        if (dbErr) throw dbErr;

        return authUser.user;
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
            if (!supabaseAdmin) throw new Error("Se requiere SERVICE_ROLE_KEY para resetear contraseñas.");
            const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
                password: data.password
            });
            if (error) throw error;
        }
        return true;
    },

    async resetAdminMFA(userId: string) {
        const { error } = await supabase.rpc('reset_admin_mfa', { p_user_id: userId });
        if (error) throw error;
        return { message: "Seguridad 2FA reseteada. El usuario deberá configurar uno nuevo." };
    },

    async deleteAdminUser(userId: string) {
        if (!supabaseAdmin) throw new Error("Se requiere SERVICE_ROLE_KEY para eliminar usuarios.");
        const { error: dbErr } = await supabaseAdmin.from('admins').delete().eq('user_id', userId);
        if (dbErr) throw dbErr;
        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authErr) throw authErr;
        return true;
    }
};
