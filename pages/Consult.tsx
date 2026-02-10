import React, { useState, useEffect, useCallback } from 'react';
import { Input, Button } from '../components/UI';
import { dbService } from '../services/dbService';

const Consult: React.FC = () => {
  const [search, setSearch] = useState({ dni: '', email: '' });
  const [results, setResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const handleSearch = useCallback(async (showLoading = true) => {
    if (showLoading) setIsSearching(true);

    try {
      const data = await dbService.findPurchasesByDni(search.dni, search.email);
      setResults(data.length > 0 ? data : null);
    } catch (error) {
      console.error("Error en búsqueda:", error);
    } finally {
      setIsSearching(false);
      setSearched(true);
    }
  }, [search.dni, search.email]);

  useEffect(() => {
    let interval: number;

    const needsPolling = results?.some(
      p => p.status === 'aprobado' && (!p.assignedNumbers || p.assignedNumbers.length === 0)
    );

    if (needsPolling && searched) {
      setIsPolling(true);
      interval = window.setInterval(() => {
        handleSearch(false);
      }, 5000);
    } else {
      setIsPolling(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [results, searched, handleSearch]);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(true);
  };

  /**
   * Requerimiento: Padding a 5 dígitos (ej: 00042)
   */
  const formatTicket = (num: number) => String(num).padStart(5, '0');

  return (
    <div className="py-12 max-w-2xl mx-auto space-y-12 px-4">
      <div className="text-center space-y-5">
        <h1 className="text-4xl md:text-5xl font-black text-blue-950 tracking-tighter leading-tight">
          Consultar mis <span className="text-blue-600">Tickets</span>
        </h1>
        <p className="text-slate-500 font-medium">
          Verifica el estado de tus reportes de pago y obtén tus números de la suerte.
        </p>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-blue-100 shadow-2xl shadow-blue-500/5">
        <form onSubmit={onFormSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Cédula / DNI"
              placeholder="Ej: 31392030"
              value={search.dni}
              onChange={e => setSearch({ ...search, dni: e.target.value })}
              required
            />
            <Input
              label="Correo Electrónico"
              type="email"
              placeholder="tu@email.com"
              value={search.email}
              onChange={e => setSearch({ ...search, email: e.target.value })}
              required
            />
          </div>
          <Button fullWidth type="submit" variant="blue" disabled={isSearching} className="py-4 text-lg">
            {isSearching ? 'Verificando...' : 'Buscar mis Tickets'}
          </Button>
        </form>
      </div>

      {searched && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {results ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center px-4">
                <h2 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.4em]">
                  Resultados Encontrados ({results.length})
                </h2>
                {isPolling && (
                  <div className="flex items-center gap-2 text-[9px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                    Asignando números en tiempo real...
                  </div>
                )}
              </div>

              {results.map((purchase) => {
                const isApproved = purchase.status === 'aprobado';
                const isRejected = purchase.status === 'rechazado';
                const isPending = purchase.status === 'pendiente';
                const hasNumbers = purchase.assignedNumbers && purchase.assignedNumbers.length > 0;

                /**
                 * Requerimiento: Etiquetas de estado sincronizadas.
                 */
                let statusLabel = '';
                if (isPending) statusLabel = 'PENDIENTE POR APROBAR';
                else if (isRejected) statusLabel = 'RECHAZADO';
                else if (isApproved && hasNumbers) statusLabel = 'APROBADO';
                else if (isApproved && !hasNumbers) statusLabel = 'APROBADO, ASIGNANDO...';

                return (
                  <div key={purchase.id} className="bg-white p-8 rounded-[3rem] border border-blue-50 shadow-xl space-y-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[4rem] -z-0 opacity-50"></div>

                    <div className="flex items-center justify-between relative z-10">
                      <div className="max-w-[70%]">
                        <h3 className="text-xl font-black text-blue-950 truncate">{purchase.user}</h3>
                        <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">{purchase.raffle}</p>
                      </div>
                      <span className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${isApproved ? 'bg-green-50 text-green-600 border-green-100' :
                          isRejected ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="space-y-5 relative z-10">
                      <span className="text-blue-900/60 text-[10px] font-black uppercase tracking-[0.2em] block">
                        {isApproved && hasNumbers ? 'Tus Números de la Suerte:' : 'Estado de tu Reporte:'}
                      </span>

                      <div className="flex flex-wrap gap-2.5">
                        {isApproved ? (
                          hasNumbers ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full animate-in zoom-in duration-500">
                              {purchase.assignedNumbers.map((num: number, i: number) => {
                                const digits = Math.max(1, (purchase.raffleTotalTickets - 1).toString().length);
                                const formattedNum = num.toString().padStart(digits, '0');

                                return (
                                  <div key={i} className="bg-slate-900 p-4 rounded-2xl text-white text-center shadow-lg border border-white/10 hover:bg-blue-600 transition-all group/num">
                                    <span className="block text-[10px] opacity-40 font-black mb-1 uppercase">Ticket</span>
                                    <span className="text-2xl font-black tabular-nums">{formattedNum}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-amber-50 border border-amber-100 p-10 rounded-3xl w-full space-y-6 text-center shadow-inner">
                              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                                <div className="absolute inset-0 border-4 border-amber-200 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-amber-600 rounded-full border-t-transparent animate-spin"></div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-amber-800 text-sm font-black uppercase tracking-tight">Pago Validado</p>
                                <p className="text-amber-600/70 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                  Aprobado, asignando tus números... Por favor espera un momento.
                                </p>
                              </div>
                            </div>
                          )
                        ) : isRejected ? (
                          <div className="bg-red-50 border border-red-100 p-8 rounded-3xl w-full text-center">
                            <p className="text-red-600 text-sm font-black uppercase tracking-tight">Reporte Rechazado</p>
                            <p className="text-red-400 text-[10px] font-bold mt-2">No pudimos validar tu pago. Contacta con soporte para más detalles.</p>
                          </div>
                        ) : (
                          <div className="bg-amber-50/50 border border-amber-100 p-10 rounded-3xl w-full text-center space-y-4">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 2" /></svg>
                            </div>
                            <div className="space-y-1">
                              <p className="text-amber-700 text-sm font-black uppercase tracking-tight">Pendiente por aprobar</p>
                              <p className="text-amber-600/60 text-[9px] font-bold uppercase">Tu reporte está en lista de espera para ser validado.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white p-16 rounded-[4rem] text-center space-y-6 border border-blue-100 shadow-sm">
              <div className="text-slate-400 font-black text-xl italic">Sin registros</div>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No hay compras asociadas a este DNI y correo.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Consult;