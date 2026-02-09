
export enum RaffleStatus {
  ACTIVA = 'active',
  PAUSADA = 'paused',
  CERRADA = 'closed',
  SORTEADA = 'drawn',
  AGOTADA = 'sold_out'
}

export type AdminRole = 'superadmin' | 'pagos';

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  created_at: string;
}

export interface Raffle {
  id: string;
  title: string;
  description: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  status: RaffleStatus;
  draw_date?: string;
  cover_url: string;
  currency?: string;
  prizes?: string[];
  created_at?: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  raffle_id: string;
  amount: number;
  ticket_count: number;
  payment_method: string;
  payment_ref: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  evidence_url?: string;
  created_at?: string;
}
