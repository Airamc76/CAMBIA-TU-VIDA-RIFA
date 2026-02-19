
import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useRaffles } from '../App';
import { RaffleStatus, Raffle } from '../types';

const RaffleBookCard: React.FC<{
  raffle: Raffle;
  position: 'prev' | 'active' | 'next' | 'hidden';
  isPast?: boolean;
}> = ({ raffle, position, isPast }) => {
  const remainingTickets = Math.max(0, (raffle.total_tickets || 0) - (raffle.sold_tickets || 0));

  // Lógica de Agotado
  const isActuallySoldOut = remainingTickets < 3 || isPast;

  const progress = isActuallySoldOut
    ? 0
    : raffle.total_tickets > 0
      ? Math.round((remainingTickets / raffle.total_tickets) * 1000) / 10
      : 0;

  // Función para color de la barra footer según porcentaje (Verde -> Rojo)
  const getFooterBarColor = (p: number) => {
    if (isActuallySoldOut) return 'bg-slate-300';
    if (p >= 70) return 'bg-[#4ADE80]'; // Verde
    if (p >= 40) return 'bg-[#FACC15]'; // Amarillo
    if (p >= 15) return 'bg-[#FB923C]'; // Naranja
    return 'bg-[#E32929]'; // Rojo
  };

  const footerColor = getFooterBarColor(progress);

  const positionClasses = {
    active: 'z-30 opacity-100 scale-100 translate-x-[-50%] rotate-0 shadow-[0_30px_70px_rgba(0,0,0,0.15)]',
    next: 'z-20 opacity-70 scale-[0.88] translate-x-[15%] md:translate-x-[10%] rotate-y-[-20deg] blur-[0.5px] pointer-events-none',
    hidden: 'z-10 opacity-40 scale-[0.75] translate-x-[50%] md:translate-x-[70%] rotate-y-[-30deg] blur-[2px] pointer-events-none',
    prev: 'z-0 opacity-0 scale-90 translate-x-[-150%] rotate-y-[20deg] pointer-events-none'
  };

  return (
    <div className={`absolute top-0 left-1/2 w-[88%] max-w-[360px] md:max-w-[420px] transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] preserve-3d ${positionClasses[position]}`}>
      <div className="bg-white rounded-[2.5rem] overflow-hidden flex flex-col h-[680px] md:h-[780px] select-none shadow-xl relative border border-slate-100">

        {/* Parte Superior: Imagen */}
        <div className="relative h-96 md:h-[420px] bg-slate-50 overflow-hidden">
          <img
            src={raffle.cover_url}
            alt={raffle.title}
            className={`w-full h-full object-cover transition-transform duration-700 ${isActuallySoldOut ? 'grayscale opacity-50' : 'hover:scale-105'}`}
            draggable="false"
          />

          {/* ETIQUETA DE PRECIO XL (Esquina superior derecha en la foto) */}
          {!isActuallySoldOut && (
            <div className="absolute top-6 right-6 z-40 transform hover:scale-105 transition-transform duration-300">
              <div className="bg-slate-950/90 backdrop-blur-xl px-6 py-4 rounded-[1.8rem] border-2 border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.4)] flex flex-col items-end min-w-[140px]">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] leading-none mb-1.5">COSTO TICKET</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl md:text-5xl font-black text-[#FF1E1E] italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(255,30,30,0.4)]">{raffle.ticket_price}</span>
                  <span className="text-lg md:text-xl font-black text-white uppercase italic tracking-tighter">{raffle.currency || 'BS'}</span>
                </div>
              </div>
            </div>
          )}

          {isActuallySoldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <span className="text-5xl font-black text-white italic drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] uppercase tracking-tighter -rotate-6 border-y-2 border-white/30 py-2 px-10">AGOTADO</span>
            </div>
          )}
        </div>

        {/* Parte Media: Info y Botones */}
        <div className="p-8 flex-1 flex flex-col text-center justify-between">
          <div className="space-y-4">
            <h3 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-[0.9]">{raffle.title}</h3>
            <p className="text-[12px] font-bold text-slate-400 uppercase leading-relaxed px-4 line-clamp-2">
              {raffle.description}
            </p>
          </div>

          <div className="flex flex-col gap-5 mt-6 px-2">
            {/* COMPRAR (ROJO MASIVO) */}
            <Link
              to={!isActuallySoldOut ? `/comprar/${raffle.id}` : '#'}
              className={`w-full py-6 rounded-[2rem] font-black text-white uppercase tracking-tight text-2xl transition-all transform active:scale-95 shadow-2xl ${isActuallySoldOut
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-[#FF0000] hover:bg-[#D90000] shadow-red-500/40 hover:-translate-y-1'
                }`}
            >
              {isActuallySoldOut ? 'RIFA CERRADA' : 'COMPRAR TICKETS'}
            </Link>

            {/* CONSULTAR (AZUL ELEGANTE) */}
            <Link
              to="/consultar"
              className="w-full py-6 rounded-[2rem] font-black text-white bg-[#0066FF] hover:bg-[#0052CC] uppercase tracking-tight text-2xl transition-all transform active:scale-95 shadow-2xl shadow-blue-500/40 hover:-translate-y-1"
            >
              CONSULTAR TICKETS
            </Link>
          </div>
        </div>

        {/* Footer: Barra Dinámica de Color */}
        <div className={`${footerColor} h-14 relative flex items-center justify-center overflow-hidden transition-colors duration-700`}>
          {/* La barra de "progreso" (color/relleno) ahora se mueve de derecha a izquierda (se agota) */}
          <div
            className="absolute top-0 right-0 h-full bg-black/10 transition-all duration-1000"
            style={{ width: `${100 - progress}%` }}
          />
          <span className="relative z-10 text-slate-950 font-black text-sm uppercase tracking-widest italic">
            {isActuallySoldOut ? 'RIFA AGOTADA' : `QUEDAN ${progress}%`}
          </span>
        </div>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { raffles, isLoading } = useRaffles();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<number | null>(null);

  const allRaffles = useMemo(() => {
    const visible = raffles.filter(r => r.status !== RaffleStatus.ELIMINADA);
    const active = visible.filter(r => r.status === RaffleStatus.ACTIVA && (r.total_tickets - (r.sold_tickets || 0)) >= 3);
    const past = visible.filter(r => r.status !== RaffleStatus.ACTIVA || (r.total_tickets - (r.sold_tickets || 0)) < 3);
    return [...active, ...past];
  }, [raffles]);

  const handleNext = () => {
    if (activeIndex < allRaffles.length - 1) {
      setActiveIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
    }
  };

  const onStart = (clientX: number) => { dragStart.current = clientX; setIsDragging(true); };
  const onMove = (clientX: number) => {
    if (!isDragging || dragStart.current === null) return;
    const diff = dragStart.current - clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNext(); else handlePrev();
      dragStart.current = null;
      setIsDragging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex flex-col items-center justify-start py-8 px-4 relative overflow-hidden select-none">

      {/* 🌫️ BACKGROUND IMAGE */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden">
        <img
          src="/background.jpg"
          alt="Background Image"
          className="w-full h-full object-cover transform scale-110"
        />
      </div>

      {/* 🏷️ BRAND LOGO (Bottom Left) */}
      <div className="absolute bottom-8 left-8 z-10 pointer-events-none hidden md:block">
        <img
          src="/brand_logo_v3.png"
          alt="Brand Logo"
          className="w-80 h-auto transition-all hover:scale-105"
        />
      </div>

      {/* 🎯 RAFFLE CAROUSEL */}
      <div
        className={`relative w-full max-w-4xl h-[680px] md:h-[780px] perspective-2000 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={() => { dragStart.current = null; setIsDragging(false); }}
        onMouseLeave={() => { dragStart.current = null; setIsDragging(false); }}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => { dragStart.current = null; setIsDragging(false); }}
      >
        {allRaffles.map((raffle, index) => {
          let pos: 'prev' | 'active' | 'next' | 'hidden' = 'hidden';
          if (index === activeIndex) pos = 'active';
          else if (index === activeIndex + 1) pos = 'next';
          else if (index > activeIndex + 1) pos = 'hidden';
          else if (index < activeIndex) pos = 'prev';

          return (
            <RaffleBookCard
              key={raffle.id}
              raffle={raffle}
              position={pos}
              isPast={raffle.status !== RaffleStatus.ACTIVA || (raffle.total_tickets - (raffle.sold_tickets || 0)) < 3}
            />
          );
        })}
      </div>

      {/* 🎯 INDICATORS */}
      <div className="mt-10 flex gap-2 z-10">
        {allRaffles.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === activeIndex ? 'w-10 bg-slate-900' : 'w-2 bg-slate-100'}`} />
        ))}
      </div>
    </div>
  );
};

export default Home;
