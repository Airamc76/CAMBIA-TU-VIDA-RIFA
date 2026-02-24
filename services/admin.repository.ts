import { supabase, SUPABASE_URL } from '../lib/supabase';
import { handleDBError } from './dbHelpers';

export const adminRepository = {
    async getPurchaseRequests(status?: 'pending' | 'approved' | 'rejected') {
        const { data: rpcData, error } = await supabase.rpc('get_admin_requests_full', {
            p_status: status || null
        });

        if (error) {
            const errStatus = (error as any).status;
            if (errStatus === 403 || errStatus === 401 || error.message?.includes('JWT')) {
                console.warn("🔒 Sesión inválida detectada (403/401). Limpiando...");
                supabase.auth.signOut().then(() => {
                    window.location.href = '/pagos';
                });
            }
            handleDBError(error, 'listar solicitudes (RPC)');
        }

        const data = rpcData || [];
        return data.map((p: any) => ({
            id: p.id,
            user: p.full_name || 'Desconocido',
            dni: p.national_id || '',
            whatsapp: p.whatsapp || '',
            email: p.email || '',
            raffle: p.raffle_title || 'Sin Título',
            raffleId: p.raffle_id,
            amount: p.amount?.toString() || '0',
            ref: p.reference || '',
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
        const now = new Date();
        const VE_OFFSET_MS = 4 * 60 * 60 * 1000;
        const nowVE = new Date(now.getTime() - VE_OFFSET_MS);
        const startOfDayVE = new Date(nowVE);
        startOfDayVE.setUTCHours(0, 0, 0, 0);
        const startOfDayUTC = new Date(startOfDayVE.getTime() + VE_OFFSET_MS);

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

        const { count: globalPending } = await supabase
            .from('purchase_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        stats.pending = globalPending || 0;
        return stats;
    },

    async getDailyHistory() {
        const { data, error } = await supabase
            .from('purchase_requests')
            .select('*, raffles:raffle_id(title)')
            .in('status', ['approved', 'rejected'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        const VE_OFFSET_MS = 4 * 60 * 60 * 1000;
        const grouped: Record<string, { date: string; totalBs: number; count: number; items: any[] }> = {};

        (data || []).forEach(p => {
            const localDate = new Date(new Date(p.created_at).getTime() - VE_OFFSET_MS);
            const dateKey = localDate.toISOString().split('T')[0];
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

        return Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([key, val]) => ({ dateKey: key, ...val }));
    },

    async updatePurchaseStatus(id: string, status: 'approved' | 'rejected') {
        const rpcName = status === 'approved' ? 'approve_purchase' : 'reject_purchase';
        const { error } = await supabase.rpc(rpcName, { p_request_id: id });
        if (error) handleDBError(error, `actualizar estado a ${status}`);

        if (status === 'approved' || status === 'rejected') {
            try {
                const { data: purchase, error: fetchError } = await supabase
                    .from('purchase_requests')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (fetchError || !purchase) {
                    console.warn("⚠️ No se pudo obtener la compra para enviar notificación:", fetchError);
                } else {
                    const { error: funcError } = await supabase.functions.invoke('send-tickets', {
                        body: { record: purchase }
                    });
                    if (funcError && status === 'approved') {
                        throw new Error(`Edge Function Error: ${funcError.message || JSON.stringify(funcError)}`);
                    }
                }
            } catch (err) {
                if (status === 'approved') throw err;
            }
        }
        return true;
    },

    async getTopBuyers(raffleId: string) {
        try {
            const { data, error } = await supabase.rpc('get_top_buyers', { p_raffle_id: raffleId });
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching top buyers:', error);
            return [];
        }
    }
};
