
import React from 'react';
import { useRaffles } from '../App';
import { RaffleStatus } from '../types';
import { ProgressBar, BadgeStatus } from './UI';

const RaffleInventory: React.FC = () => {
  const { raffles } = useRaffles();

  const activeRaffles = raffles.filter(r => r.status !== RaffleStatus.ELIMINADA);

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-12 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Inventario de Tickets</h2>
        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Monitoreo en tiempo real de disponibilidad por sorteo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {activeRaffles.map((raffle) => {
          const remaining = raffle.total_tickets - (raffle.sold_tickets || 0);
          const progress = Math.round((remaining / raffle.total_tickets) * 100);

          return (
            <div key={raffle.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-100 hover:shadow-2xl transition-all group flex flex-col gap-6 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6">
                <BadgeStatus status={raffle.status} />
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-black text-2xl text-slate-900 tracking-tighter truncate pr-20">{raffle.title}</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">ID: {raffle.id.slice(0,8)}...</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendidos</p>
                    <p className="text-2xl font-black text-slate-900">{raffle.sold_tickets || 0}</p>
                  </div>
                  <div className="bg-blue-600 p-5 rounded-3xl shadow-lg shadow-blue-600/20">
                    <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">Restantes</p>
                    <p className="text-2xl font-black text-white">{remaining}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <ProgressBar progress={progress} />
                </div>

                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 pt-2 border-t border-slate-50">
                  <span>Capacidad Total</span>
                  <span className="text-slate-900">{raffle.total_tickets} Tickets</span>
                </div>
              </div>
            </div>
          );
        })}

        {activeRaffles.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-[0.5em] italic">
            No hay sorteos activos para mostrar inventario
          </div>
        )}
      </div>
    </div>
  );
};

export default RaffleInventory;
