
import { Raffle, RaffleStatus } from '../types';

export const mockRaffles: Raffle[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'iPhone 15 Pro Max - Sorteo Especial',
    ticket_price: 310,
    currency: 'Bs',
    cover_url: 'https://picsum.photos/seed/iphone/800/600',
    status: RaffleStatus.ACTIVA,
    total_tickets: 1000,
    sold_tickets: 650,
    description: 'Participa por el último iPhone del mercado. Incluye cargador rápido y estuche original.',
    draw_date: '2024-12-31',
    prizes: ['iPhone 15 Pro Max 256GB', 'AirPods Pro 2nd Gen', 'Gift Card $50']
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Motocicleta Empire Keeway 2024',
    ticket_price: 500,
    currency: 'Bs',
    cover_url: 'https://picsum.photos/seed/bike/800/600',
    status: RaffleStatus.PAUSADA,
    total_tickets: 1000,
    sold_tickets: 300,
    description: 'Llévate una moto 0km para tus traslados diarios. Económica y confiable.',
    draw_date: '2025-01-15',
    prizes: ['Moto EK Express 150cc', 'Casco integral', 'Primer servicio gratis']
  }
];
