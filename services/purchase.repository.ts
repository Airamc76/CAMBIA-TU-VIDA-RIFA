import { supabase, supabasePublic, SUPABASE_URL } from '../lib/supabase';
import { handleDBError, normalizeDni, normalizeEmail } from './dbHelpers';

export const purchaseRepository = {
    async uploadEvidence(file: File, raffleId: string, reference: string) {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${normalizeDni(reference)}-${crypto.randomUUID()}.${ext}`;
        const path = `${raffleId}/${fileName}`;

        const { error } = await supabasePublic.storage.from('comprobantes').upload(path, file, { upsert: false });
        if (error) throw error;
        return path;
    },

    async createPublicPurchase(data: any): Promise<string> {
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
            const { data: request_id, error } = await supabasePublic.rpc('create_purchase_request', payload);
            if (error) throw error;
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
            status: row.status === 'approved' ? 'aprobado' : row.status === 'rejected' ? 'rechazado' : 'pendiente',
            evidence_url: row.receipt_path ? `${SUPABASE_URL}/storage/v1/object/public/comprobantes/${row.receipt_path}` : null,
            assignedNumbers: row.assigned_numbers || []
        }));
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
            evidence_url: data.receipt_path ? `${SUPABASE_URL}/storage/v1/object/public/comprobantes/${data.receipt_path}` : null,
            assignedNumbers: data.assigned_numbers || []
        };
    }
};
