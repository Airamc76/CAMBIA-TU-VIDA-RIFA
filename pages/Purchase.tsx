
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRaffles } from '../App';
import { Input, Button } from '../components/UI';
import { dbService } from '../services/dbService';

const Purchase: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { raffles, refreshData } = useRaffles();
  const raffle = raffles.find(r => r.id === id);

  const [form, setForm] = useState({
    dni: '',
    name: '',
    email: '',
    whatsapp: '',
    count: 3,
    paymentMethod: 'pago_movil',
    reference: '',
    file: null as File | null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!raffle) return null;

  const remaining = Math.max(0, raffle.total_tickets - (raffle.sold_tickets || 0));
  const leftAfterPurchase = remaining - form.count;
  const isLeavingOrphans = leftAfterPurchase > 0 && leftAfterPurchase < 3;
  const isOverStock = form.count > remaining;
  const isInvalidAmount = isOverStock || isLeavingOrphans || form.count < 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isInvalidAmount) return;
    if (!form.file) {
      setErrorMsg("Por favor, sube una foto del comprobante de pago.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Subir evidencia
      const receiptPath = await dbService.uploadEvidence(form.file, raffle.id, form.reference);

      // 2. Crear solicitud de compra via Edge Function
      await dbService.createPublicPurchase({
        raffleId: raffle.id,
        ticketCount: form.count,
        amount: raffle.ticket_price * form.count,
        paymentMethod: form.paymentMethod,
        paymentRef: form.reference,
        buyerEmail: form.email,
        buyerPhone: form.whatsapp,
        buyerName: form.name,
        buyerDni: form.dni,
        receiptPath: receiptPath
      });

      setIsSuccess(true);
      await refreshData();
    } catch (err: any) {
      const fullErrorMessage =
        (err?.message || 'Error desconocido') +
        (err?.details ? "\n" + err.details : "") +
        (err?.hint ? "\n" + err.hint : "");

      setErrorMsg(fullErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="py-24 flex items-center justify-center animate-in zoom-in duration-500 px-4">
        <div className="bg-white p-12 md:p-16 rounded-[4rem] text-center max-w-xl w-full space-y-10 border border-blue-50 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-xl text-white">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">¡Reporte Enviado!</h2>
            <p className="text-slate-500 font-bold max-w-sm mx-auto leading-relaxed">
              Hemos recibido tu comprobante. Nuestro staff validará el pago en las próximas horas y tus números aparecerán en la sección de consulta.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Button onClick={() => navigate('/consultar')} fullWidth variant="blue" className="py-6 text-xl">Consultar mis Tickets</Button>
            <Button onClick={() => navigate('/')} fullWidth variant="ghost" className="py-4 font-black uppercase tracking-widest text-xs">Volver al Inicio</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 max-w-5xl mx-auto px-4">
      <div className="bg-white rounded-[4rem] border border-blue-50 shadow-2xl overflow-hidden relative flex flex-col md:flex-row">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 z-10"></div>

        {/* Lado Izquierdo: Detalles de la Rifa */}
        <div className="w-full md:w-5/12 bg-slate-50 p-10 md:p-14 space-y-8 border-r border-slate-100">
          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <img
                src={raffle.cover_url || 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=2069&auto=format&fit=crop'}
                alt={raffle.title}
                className="relative w-full aspect-square object-cover rounded-[2rem] shadow-2xl"
              />
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{raffle.title}</h1>
              <div className="inline-block px-4 py-2 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-lg shadow-blue-500/30">
                {raffle.ticket_price.toLocaleString()} {raffle.currency || 'Bs'} <span className="text-[10px] opacity-60 uppercase font-black ml-1">x Ticket</span>
              </div>
              <p className="text-slate-500 font-bold leading-relaxed text-sm">
                {raffle.description || 'Participa en nuestro increíble sorteo y sé el próximo ganador. ¡Cada ticket es una oportunidad de cambiar tu vida!'}
              </p>
            </div>
          </div>

          {/* Datos de Pago Móvil */}
          <div className="bg-white p-8 rounded-[3.5rem] border border-blue-100 shadow-xl space-y-6 animate-in slide-in-from-left duration-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-[10px]">Datos de Pago Móvil</h3>
            </div>

            <div className="space-y-4">
              <div className="group cursor-pointer">
                <span className="block text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Cédula de Identidad</span>
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-lg">26.172.877</span>
                  <button onClick={() => navigator.clipboard.writeText('26172877')} className="opacity-40 group-hover:opacity-100 transition-all text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                </div>
              </div>
              <div className="group cursor-pointer">
                <span className="block text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Teléfono / Pago Móvil</span>
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-lg">0424 232 0467</span>
                  <button onClick={() => navigator.clipboard.writeText('04242320467')} className="opacity-40 group-hover:opacity-100 transition-all text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                </div>
              </div>
              <div className="group cursor-pointer border-t border-slate-50 pt-3">
                <span className="block text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Banco</span>
                <span className="font-black text-slate-900 text-[10px] block uppercase tracking-tight">0169 R4 BANCO MICRO FINANCIERO</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Formulario */}
        <div className="w-full md:w-7/12 p-10 md:p-14">
          <div className="mb-10">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Reportar Mi Pago</h2>
            <p className="text-slate-400 font-bold text-sm">Completa tus datos para confirmar tu participación.</p>
          </div>

          {/* Warning: Verify Contact Information */}
          <div className="mb-6 p-6 bg-amber-50 border-2 border-amber-200 text-amber-900 rounded-3xl font-bold text-sm flex items-start gap-4 animate-in slide-in-from-top duration-300">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div className="flex-1">
              <div className="font-black uppercase tracking-wide text-xs mb-1">⚠️ Verifica tus datos antes de enviar</div>
              <div className="text-xs leading-relaxed opacity-90">
                Asegúrate de que tu <span className="font-black">cédula, correo electrónico y WhatsApp</span> estén correctos. Si hay algún error, no podremos comunicarnos contigo para entregarte tus números o notificarte si resultas ganador.
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mx-10 md:mx-14 mb-4 p-6 bg-red-50 text-red-600 rounded-3xl font-black text-xs flex items-center gap-4 animate-in slide-in-from-top duration-300">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div className="flex-1">
                <div className="font-bold">Error en Reporte:</div>
                <div className="opacity-80 mt-1 whitespace-pre-wrap">{errorMsg}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input label="Tu Cédula / DNI" required placeholder="Ej: 31392030" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
              <Input label="Tu Nombre Completo" required placeholder="Juan Pérez" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Input label="Correo Electrónico" type="email" required placeholder="tu@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input label="WhatsApp / Celular" required placeholder="04121234567" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
            </div>

            <div className="space-y-4 bg-blue-50/50 p-8 rounded-[2.5rem] border border-blue-100/50">
              <label className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] block text-center">¿Cuántos tickets compraste?</label>
              <div className="flex items-center justify-center gap-5">
                <button type="button" onClick={() => setForm({ ...form, count: Math.max(3, form.count - 1) })} className="w-12 h-12 rounded-xl bg-white border border-blue-100 text-blue-600 font-black text-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">-</button>
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="4"
                    value={form.count}
                    onChange={e => setForm({ ...form, count: parseInt(e.target.value) || 0 })}
                    className={`w-28 text-center text-4xl font-black bg-transparent outline-none ${isInvalidAmount ? 'text-red-500' : 'text-slate-900'}`}
                  />
                  <div className="text-[10px] font-black text-blue-600 mt-1 uppercase tracking-widest">Tickets</div>
                </div>
                <button type="button" onClick={() => setForm({ ...form, count: form.count + 1 })} className="w-12 h-12 rounded-xl bg-white border border-blue-100 text-blue-600 font-black text-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">+</button>
              </div>

              <div className="text-[9px] font-black uppercase tracking-widest text-center">
                {isLeavingOrphans ? (
                  <span className="text-red-600 block bg-red-100/50 py-2 rounded-lg px-3">⚠️ Compra {remaining} o deja al menos 3.</span>
                ) : isOverStock ? (
                  <span className="text-red-600 block bg-red-100/50 py-2 rounded-lg px-3">⚠️ Máximo {remaining} disponibles.</span>
                ) : (
                  <span className="text-slate-400">Total a Pagar: <span className="text-blue-600 text-lg font-black ml-1">{(raffle.ticket_price * form.count).toLocaleString()} {raffle.currency || 'Bs'}</span></span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Método Utilizado</label>
                <select
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all opacity-75 cursor-not-allowed"
                  value={form.paymentMethod}
                  disabled
                >
                  <option value="pago_movil">Pago Móvil</option>
                </select>
              </div>
              <Input label="Código de Referencia" required placeholder="Últimos 4-6 dígitos" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
            </div>

            <div className={`p-8 rounded-[2.5rem] border-2 border-dashed transition-all text-center ${form.file ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 hover:border-blue-400'}`}>
              <input type="file" id="file" accept="image/*" className="hidden" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
              <label htmlFor="file" className="cursor-pointer space-y-3 block">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-md transition-all ${form.file ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>
                  {form.file ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  )}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] block ${form.file ? 'text-blue-900' : 'text-slate-400'}`}>
                  {form.file ? form.file.name : 'ADJUNTAR COMPROBANTE'}
                </span>
              </label>
            </div>

            <button disabled={isSubmitting || isInvalidAmount} className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.8rem] font-black text-xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-4">
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  ESTAMOS PROCESANDO...
                </>
              ) : 'CONFIRMAR MI REPORTE'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Purchase;
