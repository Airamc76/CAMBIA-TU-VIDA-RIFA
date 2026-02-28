
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRaffles } from '../App';
import { Input, Button, Modal } from '../components/UI';
import { dbService } from '../services/dbService';

const Purchase: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { raffles, refreshData } = useRaffles();
  const raffle = raffles.find(r => r.id === id);

  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [form, setForm] = useState({
    dni: '',
    name: '',
    email: '',
    whatsapp: '',
    count: 1, // Will be updated by useEffect
    paymentMethod: 'pago_movil',
    reference: '',
    file: null as File | null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (raffle && form.count < (raffle.min_tickets || 3)) {
      setForm(prev => ({ ...prev, count: raffle.min_tickets || 3 }));
    }
  }, [raffle]);

  if (!raffle) return null;

  const minTix = raffle.min_tickets || 3;
  const remaining = Math.max(0, raffle.total_tickets - (raffle.sold_tickets || 0));
  const leftAfterPurchase = remaining - form.count;
  const isLeavingOrphans = leftAfterPurchase > 0 && leftAfterPurchase < minTix;
  const isOverStock = form.count > remaining;
  const isInvalidAmount = isOverStock || isLeavingOrphans || form.count < minTix;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isInvalidAmount) return;
    if (!form.file) {
      setErrorMsg("Por favor, sube una foto del comprobante de pago.");
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    setIsConfirmModalOpen(false);
    setIsSubmitting(true);
    try {
      // 1. Subir evidencia
      const receiptPath = await dbService.uploadEvidence(form.file!, raffle.id, form.reference);

      // 2. Crear solicitud de compra via Edge Function
      const pk = await dbService.createPublicPurchase({
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

      setPurchaseId(pk);
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
              Hemos recibido tu comprobante. Nuestro staff validará el pago en las próximas horas.
            </p>
          </div>

          <div className="bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100 space-y-4">
            <h3 className="text-blue-900 font-black text-sm uppercase tracking-widest">¿Quieres recibir tus tickets por Telegram?</h3>
            <p className="text-xs text-blue-700 font-bold mb-4">Haz clic abajo para vincular tu compra con nuestro Bot y recibir notificaciones automáticas.</p>
            <Button
              onClick={() => window.open(`https://t.me/CambiaTuvidaConDavidticketsbot?start=${purchaseId}`, '_blank')}
              fullWidth
              variant="blue"
              className="py-4 bg-sky-500 hover:bg-sky-600 flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.38-.89.03-.25.38-.51 1.07-.78 4.21-1.83 7.02-3.04 8.43-3.63 4.02-1.68 4.85-1.97 5.39-1.98.12 0 .39.03.56.17.15.13.2.31.22.44.02.08.02.16.01.21z" /></svg>
              🛎️ RECIBIR POR TELEGRAM
            </Button>
            <p className="text-[10px] text-blue-400 font-bold mt-2">
              Si no tienes Telegram no te preocupes, los tickets también llegarán a tu correo electrónico.
              Si tienes alguna duda, ¡háblale a nuestro soporte por WhatsApp!
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Button onClick={() => navigate('/consultar')} fullWidth variant="ghost" className="py-2 text-slate-400 font-black">Ya tengo mis números, ir a consulta</Button>
            <Button onClick={() => navigate('/')} fullWidth variant="ghost" className="py-2 font-black uppercase tracking-widest text-[10px]">Volver al Inicio</Button>
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
                className={`relative w-full aspect-square object-contain object-${raffle.cover_position || 'center'} rounded-[2rem] shadow-2xl bg-white p-2`}
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

          {/* Selector de Tickets */}
          <div className="bg-white p-8 rounded-[3.5rem] border border-blue-100 shadow-xl space-y-6 animate-in slide-in-from-left duration-700">
            <label className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] block text-center">¿Cuántos tickets compraste?</label>
            <div className="flex items-center justify-center gap-5">
              <button type="button" onClick={() => setForm({ ...form, count: Math.max(minTix, form.count - 1) })} className="w-12 h-12 rounded-xl bg-slate-50 border border-blue-100 text-blue-600 font-black text-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">-</button>
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min={minTix}
                  value={form.count}
                  onChange={e => setForm({ ...form, count: parseInt(e.target.value) || 0 })}
                  className={`w-28 text-center text-4xl font-black bg-transparent outline-none ${isInvalidAmount ? 'text-red-500' : 'text-slate-900'}`}
                />
                <div className="text-[10px] font-black text-blue-600 mt-1 uppercase tracking-widest">Tickets</div>
              </div>
              <button type="button" onClick={() => setForm({ ...form, count: form.count + 1 })} className="w-12 h-12 rounded-xl bg-slate-50 border border-blue-100 text-blue-600 font-black text-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">+</button>
            </div>

            <div className="text-[10px] font-black uppercase tracking-widest text-center space-y-2">
              {isLeavingOrphans ? (
                <span className="text-red-600 block bg-red-100/50 py-2 rounded-lg px-3">⚠️ Compra {remaining} o deja al menos {minTix}.</span>
              ) : isOverStock ? (
                <span className="text-red-600 block bg-red-100/50 py-2 rounded-lg px-3">⚠️ Máximo {remaining} disponibles.</span>
              ) : (
                <span className="text-slate-400">Total a Pagar: <span className="text-blue-600 text-lg font-black ml-1">{(raffle.ticket_price * form.count).toLocaleString()} {raffle.currency || 'Bs'}</span></span>
              )}

              <div className="pt-2 border-t border-slate-50">
                <span className="text-blue-600 font-black text-[11px] bg-blue-50 px-4 py-2 rounded-full inline-block">
                  Mínimo de compra: {minTix} tickets
                </span>
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

          {/* Warning Removed */}

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

            {/* Datos de Pago Móvil */}
            <div className="space-y-4 bg-blue-50/50 p-8 rounded-[2.5rem] border border-blue-100/50">
              <div className="flex items-center gap-3 mb-4">
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
                    <button type="button" onClick={() => navigator.clipboard.writeText('26172877')} className="opacity-40 group-hover:opacity-100 transition-all text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                  </div>
                </div>
                <div className="group cursor-pointer">
                  <span className="block text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Teléfono / Pago Móvil</span>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 text-lg">0414 017 0156</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText('04140170156')} className="opacity-40 group-hover:opacity-100 transition-all text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                  </div>
                </div>
                <div className="group cursor-pointer border-t border-slate-50 pt-3">
                  <span className="block text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Banco</span>
                  <div className="flex items-center gap-4">
                    <img
                      src="/bank_logo_r4.png"
                      alt="Logo R4"
                      onClick={() => setIsLogoModalOpen(true)}
                      className="w-14 h-14 object-contain rounded-xl bg-white p-1.5 border border-slate-100 shadow-md cursor-zoom-in hover:scale-105 transition-transform"
                    />
                    <span className="font-black text-slate-900 text-[10px] block uppercase tracking-tight">0169 R4 BANCO MICRO FINANCIERO</span>
                  </div>
                </div>
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

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirmar Reporte"
        footer={
          <div className="flex w-full gap-4">
            <Button variant="ghost" onClick={() => setIsConfirmModalOpen(false)} fullWidth className="text-slate-400 font-black">
              Cancelar
            </Button>
            <Button variant="blue" onClick={handleFinalSubmit} fullWidth className="font-black">
              Sí, Confirmar Datos
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-3xl flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div className="flex-1">
              <h4 className="font-black text-amber-900 uppercase tracking-wide text-xs mb-2">⚠️ Verifica tus datos antes de enviar</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Estás reportando el pago para <span className="font-black">{form.count} tickets</span> por un total de <span className="font-black">{(raffle.ticket_price * form.count).toLocaleString()} {raffle.currency || 'Bs'}</span>.
                <br /><br />
                Por favor confirma que tu <span className="font-black">Cédula ({form.dni})</span>, <span className="font-black">Email ({form.email})</span> y <span className="font-black">WhatsApp ({form.whatsapp})</span> son correctos.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Términos y Condiciones</h4>
            <div className="max-h-60 overflow-y-auto bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <p className="text-xs text-slate-500 font-bold italic mb-4">Por favor, lee y acepta nuestros términos para participar.</p>

              {[
                "Los números disponibles para la compra en cada sorteo se especificarán en la página de detalles correspondientes a cada sorteo.",
                "Debes verificar tu compra antes de confirmarla haciendo clic en \"Comprar\". No realizamos reembolsos por errores cometidos por el usuario.",
                "Los tickets se enviarán en un plazo máximo de 24 horas, debido al alto volumen de pagos por procesar.",
                "Solo pueden participar personas naturales mayores de 18 años con nacionalidad venezolana o extranjeros. Los ganadores en el extranjero deberán designar a una persona de confianza en Venezuela para recibir el premio.",
                "Los premios deben retirarse en persona en la ubicación designada para cada sorteo. Realizamos entregas personales únicamente en la dirección indicada por el ganador del primer premio o premio mayor.",
                `La compra mínima requerida para participar es de ${minTix} tickets. Estos se asignarán de manera aleatoria y se enviarán al correo electrónico proporcionados.`,
                "Tienes un plazo de 72 horas para reclamar tu premio.",
                "Los ganadores aceptan aparecer en el contenido audiovisual del sorteo, mostrando su presencia en redes sociales y durante la entrega de premios. Esto es OBLIGATORIO."
              ].map((term, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white font-black text-[10px]">{index + 1}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed text-justify">{term}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        title="Datos de Banco R4"
      >
        <div className="flex flex-col items-center justify-center p-4 space-y-6">
          <img
            src="/bank_logo_r4.png"
            alt="Logo R4 Grande"
            className="w-full max-w-[280px] aspect-square object-contain bg-white rounded-3xl p-6 shadow-2xl border border-slate-100"
          />
          <div className="text-center space-y-2">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm">Banco Microfinanciero R4</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">0169 - Microfinanciero</p>
          </div>
          <Button variant="blue" onClick={() => setIsLogoModalOpen(false)} fullWidth className="font-black">
            Cerrar Vista
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Purchase;
