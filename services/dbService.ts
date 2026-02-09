
import { supabase, supabasePublic, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase';
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
    const url = `${SUPABASE_URL}/functions/v1/public-create-request`;
    
    const payload = {
      raffle_id: data.raffleId,
      full_name: data.buyerName,
      national_id: normalizeDni(data.buyerDni),
      email: normalizeEmail(data.buyerEmail),
      whatsapp: normalizeDni(data.buyerPhone),
      ticket_qty: Number(data.ticketCount),
      amount: Number(data.amount),
      payment_method: data.paymentMethod,
      reference: String(data.paymentRef || '').trim(),
      receipt_path: data.receiptPath,
      status: "pending"
    };

    // PRUEBA DEFINITIVA (Log solicitado)
    console.log("USING SUPABASE URL:", SUPABASE_URL);
    console.log("Payload:", payload);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let result;
      try { result = JSON.parse(text); } catch { result = { raw: text }; }

      if (!res.ok) {
        console.error("❌ public-create-request failed:", res.status, result);
        const errorMsg = result?.error || result?.message || result?.raw || "Error desconocido en función";
        throw new Error(errorMsg);
      }

      console.log("✅ Purchase request creada (via function):", result);
      return result.request_id || result.id;
    } catch (err: any) {
      console.error("❌ ERROR REAL INSERT/FUNCTION:", err);
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
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No hay sesión activa.");

    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-approve-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ request_id: id, status: status }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error al procesar la solicitud.");
    }
    return true;
  },

  async getAdminUsers() {
    const { data, error } = await supabase.rpc('get_admin_users');
    if (error) throw error;
    return data;
  },

  async createAdminUser(data: any) {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/superadmin-users-create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': SUPABASE_ANON_KEY 
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al crear usuario');
    return response.json();
  },

  async updateAdminUser(data: any) {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/superadmin-users-update`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': SUPABASE_ANON_KEY 
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al actualizar usuario');
    return response.json();
  },

  async resetAdminMFA(userId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/superadmin-users-reset-mfa`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': SUPABASE_ANON_KEY 
      },
      body: JSON.stringify({ user_id: userId })
    });
    if (!response.ok) throw new Error('Error al resetear MFA');
    return response.json();
  },

  async saveRaffle(raffle: Raffle) {
    const { data, error } = await supabase.from('raffles').upsert(raffle).select().single();
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
  }
};
