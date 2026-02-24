
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



    // Fix: Use RPC to get role
    const { data: role, error: roleError } = await supabase.rpc('get_my_role');

    // get_my_role returns text, or null if no role
    if (roleError || !role) {
      await supabase.auth.signOut();
      throw new Error('No autorizado.');
    }

    return { userId: authData.user.id, email: authData.user.email, role: role as AdminRole };
  },

  async signOut() { await supabase.auth.signOut(); },

  // --- 2. RIFAS ---
  async getRaffles() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Configuración de Supabase incompleta (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
    }

    const queryPromise = supabasePublic
      .from('raffles')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    const timeoutMs = 15000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout cargando rifas. Verifica conexión a Supabase.')), timeoutMs)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
    if (error) handleDBError(error, 'getRaffles');

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
  async createPublicPurchase(data: any): Promise<string> {
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
  async getPurchaseRequests(status?: 'pending' | 'approved' | 'rejected') {
    // Usamos la RPC "full" para traer los datos ya unidos con el título de la rifa.
    // Esto evita problemas de permisos RLS en la tabla 'raffles' al hacer join desde el cliente.
    const { data: rpcData, error } = await supabase.rpc('get_admin_requests_full', {
      p_status: status || null
    });

    console.log(`🔍 RPC [${status || 'all'}] response:`, { dataLength: rpcData?.length, error });

    if (error) {
      // 🚨 FIX "ZOMBIE SESSION"
      const status = (error as any).status;
      if (status === 403 || status === 401 || error.message?.includes('JWT')) {
        console.warn("🔒 Sesión inválida detectada (403/401). Limpiando...");
        supabase.auth.signOut().then(() => {
          window.location.href = '/pagos';
        });
      }
      handleDBError(error, 'listar solicitudes (RPC)');
    }

    // Al retornar JSON desde Postgres, 'rpcData' YA ES el array.
    // A veces Supabase lo envuelve, pero con returns json suele ser directo.
    const data = rpcData || [];

    if (data.length === 0) {
      console.warn("⚠️ RPC devolvió 0 registros.");
    }

    return data.map((p: any) => ({
      id: p.id,
      user: p.full_name || 'Desconocido',
      dni: p.national_id || '',
      whatsapp: p.whatsapp || '',
      email: p.email || '',
      raffle: p.raffle_title || 'Sin Título',
      raffleId: p.raffle_id,
      amount: p.amount?.toString() || '0',
      ref: p.reference || '', // Fix: Ensure reference is never null to avoid .toLowerCase() crash
      date: new Date(p.created_at).toLocaleDateString(),
      ticketsCount: p.ticket_qty || 0,
      status: p.status === 'approved' ? 'aprobado' : p.status === 'rejected' ? 'rechazado' : 'pendiente',
      evidence_url: p.receipt_path ? `${SUPABASE_URL}/storage/v1/object/public/comprobantes/${p.receipt_path}` : null
    }));
  },

  async getPendingPurchaseRequests() {
    return this.getPurchaseRequests('pending');
  },

  async getAdminStats() {
    // Ajuste de zona horaria Venezuela (UTC-4)
    // Calculamos el inicio del día de hoy en hora local venezolana -> pasamos a UTC para la query
    const now = new Date();
    // Venezuela es UTC-4, así que restamos 4h para obtener hora local VE
    const VE_OFFSET_MS = 4 * 60 * 60 * 1000;
    const nowVE = new Date(now.getTime() - VE_OFFSET_MS);
    // Inicio del día en VE (medianoche local)
    const startOfDayVE = new Date(nowVE);
    startOfDayVE.setUTCHours(0, 0, 0, 0);
    // Convertir ese inicio de día VE de vuelta a UTC
    const startOfDayUTC = new Date(startOfDayVE.getTime() + VE_OFFSET_MS);

    // Traemos todos los approved/rejected del historial para la query de hoy
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('status, amount, created_at')
      .gte('created_at', startOfDayUTC.toISOString());

    if (error) throw error;

    const stats = {
      pending: 0,
      approvedToday: 0,
      rejectedToday: 0,
      totalAmountToday: 0
    };

    data?.forEach(p => {
      if (p.status === 'pending') stats.pending++;
      if (p.status === 'approved') {
        stats.approvedToday++;
        stats.totalAmountToday += Number(p.amount || 0);
      }
      if (p.status === 'rejected') stats.rejectedToday++;
    });

    // Para el contador global de pendientes (no solo hoy)
    const { count: globalPending } = await supabase
      .from('purchase_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    stats.pending = globalPending || 0;

    return stats;
  },

  async getDailyHistory() {
    // Trae todos los aprobados y rechazados, agrupados por fecha venezolana
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*, raffles:raffle_id(title)')
      .in('status', ['approved', 'rejected'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const VE_OFFSET_MS = 4 * 60 * 60 * 1000;

    // Agrupar por fecha local Venezuela
    const grouped: Record<string, { date: string; totalBs: number; count: number; items: any[] }> = {};

    (data || []).forEach(p => {
      const localDate = new Date(new Date(p.created_at).getTime() - VE_OFFSET_MS);
      const dateKey = localDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const displayDate = localDate.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: displayDate, totalBs: 0, count: 0, items: [] };
      }

      const item = {
        id: p.id,
        user: p.full_name,
        dni: p.national_id,
        raffle: (p.raffles as any)?.title,
        amount: Number(p.amount || 0),
        ticketsCount: p.ticket_qty,
        status: p.status,
        evidence_url: p.receipt_path ? `${SUPABASE_URL}/storage/v1/object/public/comprobantes/${p.receipt_path}` : null,
        time: localDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
      };

      grouped[dateKey].items.push(item);
      if (p.status === 'approved') {
        grouped[dateKey].totalBs += Number(p.amount || 0);
        grouped[dateKey].count++;
      }
    });

    // Retornar como array ordenado de más reciente a más antiguo
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => ({ dateKey: key, ...val }));
  },

  async updatePurchaseStatus(id: string, status: 'approved' | 'rejected') {
    const rpcName = status === 'approved' ? 'approve_purchase' : 'reject_purchase';

    // Llamar a RPC correspondiente para manejar la transacción de tickets
    const { error } = await supabase.rpc(rpcName, { p_request_id: id });
    if (error) handleDBError(error, `actualizar estado a ${status}`);

    // Si se aprobó o rechazó, disparar notificaciones (Edge Function)
    if (status === 'approved' || status === 'rejected') {
      try {
        console.log(`🚀 Disparando Edge Function 'send-tickets' (${status})...`);

        // 1. Obtener datos frescos de la compra para enviar al webhook
        const { data: purchase, error: fetchError } = await supabase
          .from('purchase_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !purchase) {
          console.warn("⚠️ No se pudo obtener la compra para enviar notificación:", fetchError);
        } else {
          // 2. Invocar función
          const { data: funcData, error: funcError } = await supabase.functions.invoke('send-tickets', {
            body: { record: purchase }
          });

          if (funcError) {
            console.error("❌ Error al invocar Edge Function 'send-tickets':", funcError);
            // Si es aprobación, lanzamos el error para que el admin sepa. 
            // Si es rechazo, es menos crítico pero igual lo registramos.
            if (status === 'approved') {
              const errorMsg = funcError.message || JSON.stringify(funcError);
              throw new Error(`Edge Function Error: ${errorMsg}`);
            }
          } else {
            console.log("✅ Edge Function Result:", funcData);
          }
        }
      } catch (err) {
        console.error("❌ Error inesperado al invocar send-tickets:", err);
        if (status === 'approved') throw err; // Solo detenemos el proceso si es aprobación
      }
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
  },

  async getPurchaseById(id: string) {
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*, raffles:raffle_id(title)')
      .eq('id', id)
      .single();

    if (error) return null;

    return {
      id: data.id,
      user: data.full_name || 'Desconocido',
      dni: data.national_id || '',
      whatsapp: data.whatsapp || '',
      email: data.email || '',
      raffle: (data.raffles as any)?.title || 'Sin Título',
      raffleId: data.raffle_id,
      amount: data.amount?.toString() || '0',
      ref: data.reference || '',
      date: new Date(data.created_at).toLocaleDateString(),
      ticketsCount: data.ticket_qty || 0,
      status: data.status === 'approved' ? 'aprobado' : data.status === 'rejected' ? 'rechazado' : 'pendiente',
      assignedNumbers: data.assigned_numbers || []
    };
  },

  async getTopBuyers(raffleId: string) {
    try {
      const { data, error } = await supabase.rpc('get_top_buyers', { p_raffle_id: raffleId });
      if (error) {
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('Error fetching top buyers:', error);
      return [];
    }
  }
};
