
import { supabase, supabasePublic, supabaseAdmin, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase';
import { Raffle, AdminRole } from '../types';

/**
 * Manejador de errores Pro: 
 * Captura y formatea errores reales para debugging técnico.
 */
const handleDBError = (error: any, context: string) => {
  console.error(`❌ ERROR EN ${context.toUpperCase()}:`, error);

  const msg = error?.message || 'Error desconocido';
  const details = error?.details ? `\nDetalles: ${error.details}` : '';
  const hint = error?.hint ? `\nSugerencia: ${error.hint}` : '';

  const err = new Error(msg);
  (err as any).details = details;
  (err as any).hint = hint;
  throw err;
};

const normalizeDni = (dni: string) => String(dni || '').replace(/\D/g, '');
const normalizeEmail = (email: string) => String(email || '').trim().toLowerCase();

export const dbService = {
  // --- 1. AUTENTICACIÓN ---
  async login(email: string, pass: string) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: pass
    });
    if (authError) throw authError;

    const { data: admin } = await supabase.from('admins').select('role').eq('user_id', authData.user.id).single();

    if (!admin) {
      await supabase.auth.signOut();
      throw new Error('No autorizado.');
    }

    return { userId: authData.user.id, email: authData.user.email, role: admin.role as AdminRole };
  },

  async signOut() { await supabase.auth.signOut(); },

  // --- 2. RIFAS ---
  async getRaffles() {
    const { data, error } = await supabasePublic.from('raffles').select('*').order('created_at', { ascending: false });
    return (data || []) as Raffle[];
  },

  // --- 3. COMPRAS PÚBLICAS (Llamada a Edge Function DEFINITIVA) ---
  async uploadEvidence(file: File, raffleId: string, reference: string) {
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${normalizeDni(reference)}-${crypto.randomUUID()}.${ext}`;
    const path = `${raffleId}/${fileName}`;

    const { error } = await supabasePublic.storage.from('comprobantes').upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  },

  /**
   * createPublicPurchase: Llama a la Edge Function pública para procesar la compra.
   * ✅ Snippet fetch definitivo.
   */
  async createPublicPurchase(data: any) {
    // 1. Validar datos mínimos
    if (!data.buyerName || !data.buyerDni || !data.amount) {
      throw new Error("Faltan datos obligatorios para la compra.");
    }

    const payload = {
      p_raffle_id: data.raffleId,
      p_full_name: data.buyerName,
      p_national_id: normalizeDni(data.buyerDni),
      p_email: normalizeEmail(data.buyerEmail),
      p_whatsapp: normalizeDni(data.buyerPhone),
      p_ticket_qty: Number(data.ticketCount),
      p_amount: Number(data.amount),
      p_payment_method: data.paymentMethod,
      p_reference: String(data.paymentRef || '').trim(),
      p_receipt_path: data.receiptPath || null
    };


    try {
      // Usamos RPC (Remote Procedure Call) para saltar la restricción de SELECT RLS
      const { data: request_id, error } = await supabasePublic
        .rpc('create_purchase_request', payload);

      if (error) {
        console.error("❌ RPC Failed:", error);
        throw error;
      }

      return request_id;
    } catch (err: any) {
      console.error("❌ ERROR REAL RPC:", err);
      throw err;
    }
  },

  async findPurchasesByDni(dni: string, email: string) {
    const cleanDni = normalizeDni(dni);
    const cleanEmail = normalizeEmail(email);

    const { data, error } = await supabasePublic.rpc('get_my_tickets', {
      p_dni: cleanDni,
      p_email: cleanEmail
    });

    if (error) handleDBError(error, 'get_my_tickets (rpc)');

    return (data || []).map((row: any) => ({
      id: row.request_id || row.id,
      user: row.full_name || row.email || 'Invitado',
      dni: row.national_id,
      whatsapp: row.whatsapp || '',
      email: row.email || '',
      raffle: row.raffle_title || 'Sorteo',
      raffleTotalTickets: row.raffle_total_tickets || 0,
      amount: row.amount?.toString() || '0',
      ref: row.reference || 'S/R',
      date: new Date(row.created_at).toLocaleDateString(),
      ticketsCount: row.ticket_qty || 0,
      status:
        row.status === 'approved' ? 'aprobado' :
          row.status === 'rejected' ? 'rechazado' :
            'pendiente',
      evidence_url: row.receipt_path ? `${SUPABASE_URL}/storage/v1/object/public/comprobantes/${row.receipt_path}` : null,
      assignedNumbers: row.assigned_numbers || []
    }));
  },

  // --- 4. ADMIN ---
  async getPendingPurchaseRequests() {
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*, raffles:raffle_id(title)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) handleDBError(error, 'listar solicitudes');

    return (data || []).map(p => ({
      id: p.id,
      user: p.full_name,
      dni: p.national_id,
      whatsapp: p.whatsapp,
      email: p.email,
      raffle: (p.raffles as any)?.title,
      raffleId: p.raffle_id,
      amount: p.amount?.toString(),
      ref: p.reference,
      date: new Date(p.created_at).toLocaleDateString(),
      ticketsCount: p.ticket_qty,
      status: 'pendiente',
      evidence_url: p.receipt_path ? `${SUPABASE_URL}/storage/v1/object/public/comprobantes/${p.receipt_path}` : null
    }));
  },

  async updatePurchaseStatus(id: string, status: 'approved' | 'rejected') {
    const rpcName = status === 'approved' ? 'approve_purchase' : 'reject_purchase';

    // Llamar a RPC correspondiente para manejar la transacción de tickets
    const { error } = await supabase.rpc(rpcName, { p_request_id: id });

    if (error) {
      console.error(`Error en ${rpcName}:`, error);
      throw error;
    }
    return true;
  },

  // --- 5. GESTIÓN DE USUARIOS (SUPERADMIN) ---

  async getAdminUsers() {
    const { data, error } = await supabase.rpc('get_admin_users');
    if (error) throw error;
    return data;
  },

  async createAdminUser(data: any) {
    if (!supabaseAdmin) {
      throw new Error("Configuración incompleta: Se requiere SERVICE_ROLE_KEY para crear usuarios.");
    }

    // 1. Crear en Auth
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true
    });
    if (authErr) throw authErr;

    // 2. Crear en tabla admins (Usamos supabaseAdmin para saltar RLS)
    const { error: dbErr } = await supabaseAdmin.from('admins').insert({
      user_id: authUser.user.id,
      role: data.role
    });
    if (dbErr) throw dbErr;

    return authUser.user;
  },

  async updateAdminUser(data: any) {
    // Si es cambio de ROL (pasa por nuestra tabla admins)
    if (data.role) {
      const { error } = await supabase.rpc('update_admin_role', {
        p_user_id: data.user_id,
        p_role: data.role
      });
      if (error) throw error;
    }

    // Si es cambio de PASSWORD (requiere supabaseAdmin)
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
    // Usamos el RPC que borra de auth.mfa_factors
    const { error } = await supabase.rpc('reset_admin_mfa', { p_user_id: userId });
    if (error) throw error;

    return { message: "Seguridad 2FA reseteada. El usuario deberá configurar uno nuevo." };
  },

  async getMyRole() {
    const { data, error } = await supabase.rpc('get_my_role');
    if (error) throw error;
    return data as AdminRole;
  },

  async saveRaffle(raffle: Raffle) {
    const { data, error } = await supabase.rpc('save_raffle', { p_raffle: raffle });
    if (error) throw error;
    return data;
  },

  async deleteRaffle(id: string) {
    await supabase.from('raffles').delete().eq('id', id);
  },

  async uploadRaffleImage(file: File) {
    const path = `raffles/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('comprobantes').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('comprobantes').getPublicUrl(path);
    return data.publicUrl;
  },

  async deleteAdminUser(userId: string) {
    if (!supabaseAdmin) throw new Error("Se requiere SERVICE_ROLE_KEY para eliminar usuarios.");

    // 1. Eliminar de tabla admins primero (por FK)
    const { error: dbErr } = await supabaseAdmin.from('admins').delete().eq('user_id', userId);
    if (dbErr) throw dbErr;

    // 2. Eliminar de Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) throw authErr;

    return true;
  },

  async searchTicketWinner(raffleId: string, ticketNumber: number) {
    const { data, error } = await supabase.rpc('search_ticket_winner', {
      p_raffle_id: raffleId,
      p_number: ticketNumber
    });

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }
};
