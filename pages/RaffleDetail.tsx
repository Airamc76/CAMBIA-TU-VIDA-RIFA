
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useRaffles } from '../App';
import { BadgeStatus, ProgressBar, Button } from '../components/UI';
import { RaffleStatus } from '../types';

const RaffleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { raffles } = useRaffles();
  const raffle = raffles.find(r => r.id === id);

  if (!raffle) {
    return <Navigate to="/" />;
  }

  const remainingTickets = Math.max(0, (raffle.total_tickets || 0) - (raffle.sold_tickets || 0));
  
  // Bloqueo si no quedan al menos 4 tickets para una compra mínima válida
  const hasMinStock = remainingTickets >= 4;
  const isActuallySoldOut = remainingTickets <= 0 || !hasMinStock;
  const isAvailable = raffle.status === RaffleStatus.ACTIVA && !isActuallySoldOut;
  
  // Si está agotado o bajo stock mínimo, disponibilidad es 0%
  const progress = isActuallySoldOut 
    ? 0 
    : raffle.total_tickets > 0 
      ? Math.round((remainingTickets / raffle.total_tickets) * 100) 
      : 0;

  const displayStatus = isActuallySoldOut ? 'AGOTADA' : raffle.status;

  return (
    <div className="py-12 max-w-6xl mx-auto px-4">
      <Link to="/" className="inline-flex items-center gap-3 text-blue-500 hover:text-blue-700 font-black uppercase text-[10px] tracking-[0.2em] transition-all mb-12 group">
        <div className="w-9 h-9 rounded-full border border-blue-100 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-200 transition-all">
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
        </div>
        Volver al Inicio
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        <div className="space-y-8">
          <div className="bg-white p-3 rounded-[3.5rem] border-2 border-blue-50 shadow-[0_40px_80px_-20px_rgba(59,130,246,0.1)] overflow-hidden relative">
            <img 
              src={raffle.cover_url} 
              alt={raffle.title} 
              className={`w-full aspect-square object-cover rounded-[2.8rem] ${!isAvailable ? 'grayscale opacity-50' : ''}`} 
            />
            {!isAvailable && (
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="bg-white/90 backdrop-blur-md px-10 py-5 rounded-[2rem] shadow-2xl border border-blue-100/50 -rotate-12">
                    <span className="text-4xl font-black text-blue-900 uppercase tracking-tighter">
                        {isActuallySoldOut && remainingTickets > 0 ? 'STOCK FINAL' : 'AGOTADA'}
                    </span>
                 </div>
               </div>
            )}
          </div>
          
          <div className="bg-white p-10 rounded-[3rem] border border-blue-100/50 shadow-sm">
            <h2 className="text-xl font-black mb-8 text-blue-900 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
              </div>
              Premios Incluidos
            </h2>
            <ul className="space-y-6">
              {raffle.prizes?.length ? raffle.prizes.map((prize, idx) => (
                <li key={idx} className="flex items-center gap-5 group">
                  <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-black group-hover:bg-blue-600 group-hover:text-white transition-all">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-slate-700 text-lg">{prize}</span>
                </li>
              )) : (
                <li className="text-slate-400 italic">Premios por definir.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-10 lg:sticky lg:top-24">
          <div className="space-y-6">
            <BadgeStatus status={displayStatus} />
            <h1 className="text-4xl md:text-6xl font-black text-blue-950 leading-[1.05] tracking-tighter">{raffle.title}</h1>
            <div className="flex items-center gap-4 text-blue-600 font-black text-xs uppercase tracking-widest bg-blue-50/50 w-fit px-6 py-3 rounded-2xl border border-blue-100">
              Disponibilidad real: <span className="text-blue-900 ml-1">{hasMinStock ? remainingTickets : 0} tickets</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-10 rounded-[3.5rem] space-y-10 border-2 border-blue-100 shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
               <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.5em] mb-4">Costo del Ticket</p>
               <div className="text-7xl font-black flex items-baseline gap-4 text-blue-950 tracking-tighter">
                 {raffle.ticket_price} <span className="text-3xl font-bold text-blue-600 uppercase">{raffle.currency || 'Bs'}</span>
               </div>
            </div>
            
            <div className="relative z-10">
               <ProgressBar progress={progress} />
            </div>
            
            <div className="relative z-10 space-y-8 pt-2">
              <Link to={isAvailable ? `/comprar/${raffle.id}` : '#'} className="block">
                <Button 
                  fullWidth 
                  disabled={!isAvailable} 
                  className={`py-8 text-2xl font-black rounded-[2.5rem] transition-all transform active:scale-[0.98] ${
                    isAvailable 
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none grayscale'
                  }`}
                >
                  {isActuallySoldOut ? 'Agotada' : isAvailable ? 'Comprar Tickets' : 'Pausada'}
                </Button>
              </Link>
              {!hasMinStock && remainingTickets > 0 && (
                  <p className="text-center text-[10px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 py-3 rounded-xl border border-amber-100">
                      Quedan {remainingTickets} tickets (menos del mínimo de 4). Rifa cerrada.
                  </p>
              )}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-blue-50 shadow-sm space-y-6">
            <h2 className="text-lg font-black text-blue-900 uppercase tracking-widest flex items-center gap-4">
              <div className="w-2.5 h-8 bg-blue-600 rounded-full shadow-sm"></div>
              Detalles
            </h2>
            <p className="text-slate-500 leading-relaxed font-bold text-lg">
              {raffle.description || 'Participa y conviértete en el próximo ganador.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RaffleDetail;
