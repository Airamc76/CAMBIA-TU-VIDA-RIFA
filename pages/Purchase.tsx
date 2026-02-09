
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
    count: 4,
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
  const isLeavingOrphans = leftAfterPurchase > 0 && leftAfterPurchase < 4;
  const isOverStock = form.count > remaining;
  const isInvalidAmount = isOverStock || isLeavingOrphans || form.count < 4;

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
      // MOSTRAR ERROR REAL (Solicitado para Debug)
      const fullErrorMessage = 
        (err?.message || 'Error desconocido') + 
        (err?.details ? "\n" + err.details : "") + 
        (err?.hint ? "\n" + err.hint : "");
        
      alert(fullErrorMessage);
      console.error("❌ REAL INSERT ERROR:", err);
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
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
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
    <div className="py-12 max-w-2xl mx-auto px-4">
      <div className="bg-white rounded-[4rem] border border-blue-50 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        
        <div className="p-10 md:p-14 pb-4">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Reportar Pago</h1>
          <p className="text-slate-400 font-bold mt-2">Sorteo: <span className="text-blue-600">{raffle.title}</span></p>
        </div>

        {errorMsg && (
          <div className="mx-10 md:mx-14 mb-4 p-6 bg-red-50 text-red-600 rounded-3xl font-black text-xs flex items-center gap-4 animate-in slide-in-from-top duration-300">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <div className="flex-1">
               <div className="font-bold">Error en Reporte:</div>
               <div className="opacity-80 mt-1 whitespace-pre-wrap">{errorMsg}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-10 md:p-14 pt-2 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Input label="Cédula / DNI" required placeholder="Ej: 31392030" value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} />
            <Input label="Nombre Completo" required placeholder="Juan Pérez" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <Input label="Correo Electrónico" type="email" required placeholder="tu@email.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <Input label="WhatsApp / Teléfono" required placeholder="04121234567" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} />
          </div>

          <div className="space-y-6 text-center bg-slate-50 p-10 rounded-[3rem] border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] block">¿Cuántos tickets compraste?</label>
            <div className="flex items-center justify-center gap-6">
               <button type="button" onClick={() => setForm({...form, count: Math.max(4, form.count - 1)})} className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-slate-400 font-black text-2xl hover:bg-blue-50 hover:text-blue-600 transition-all">-</button>
               <input 
                  type="number" 
                  min="4" 
                  value={form.count} 
                  onChange={e => setForm({...form, count: parseInt(e.target.value) || 0})}
                  className={`w-32 h-20 text-center text-5xl font-black bg-transparent outline-none transition-all ${isInvalidAmount ? 'text-red-500' : 'text-slate-900'}`}
                />
               <button type="button" onClick={() => setForm({...form, count: form.count + 1})} className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-slate-400 font-black text-2xl hover:bg-blue-50 hover:text-blue-600 transition-all">+</button>
            </div>
            
            <div className="text-[10px] font-black uppercase tracking-widest pt-2">
              {isLeavingOrphans ? (
                <span className="text-red-600 block bg-red-50 py-3 rounded-xl px-4">⚠️ No puedes dejar {leftAfterPurchase} tickets huérfanos. <br/> Compra {remaining} o deja al menos 4.</span>
              ) : isOverStock ? (
                <span className="text-red-600 block bg-red-50 py-3 rounded-xl px-4">⚠️ Superas el límite de {remaining} disponibles.</span>
              ) : (
                <span className="text-blue-500">Mínimo: 4 | Disponibles: {remaining}</span>
              )}
            </div>
            <div className="text-2xl font-black text-slate-900 mt-4">
               Total: <span className="text-blue-600">{(raffle.ticket_price * form.count).toLocaleString()} {raffle.currency || 'Bs'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Método de Pago</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-blue-500/10" value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}>
                <option value="pago_movil">Pago Móvil</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="binance">Binance Pay (USDT)</option>
                <option value="zelle">Zelle</option>
              </select>
            </div>
            <Input label="Nro de Referencia" required placeholder="Últimos 4-6 dígitos" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
          </div>

          <div className={`p-10 rounded-[2.5rem] border-2 border-dashed transition-all text-center ${form.file ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200 hover:border-blue-300'}`}>
            <input type="file" id="file" accept="image/*" className="hidden" onChange={e => setForm({...form, file: e.target.files?.[0] || null})} />
            <label htmlFor="file" className="cursor-pointer space-y-4 block">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg transition-all ${form.file ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>
                {form.file ? (
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                ) : (
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                )}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest block ${form.file ? 'text-blue-900' : 'text-slate-400'}`}>
                {form.file ? form.file.name : 'ADJUNTAR COMPROBANTE (FOTO)'}
              </span>
            </label>
          </div>

          <button disabled={isSubmitting || isInvalidAmount} className="w-full py-8 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-4">
            {isSubmitting ? (
               <>
                 <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                 ENVIANDO...
               </>
            ) : 'ENVIAR REPORTE'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Purchase;
