
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRaffles } from '../App';
import { Button, Input } from '../components/UI';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';

type AuthStep = 'login' | 'mfa-setup' | 'mfa-verify';

const AdminPagos: React.FC = () => {
  const navigate = useNavigate();
  const { raffles, purchases, userRole, setUserRole, refreshData, updatePurchaseStatus } = useRaffles();

  // --- BUSCADOR DE GANADORES ---
  const [searchRaffleId, setSearchRaffleId] = useState('');
  const [searchTicket, setSearchTicket] = useState('');
  const [winnerResult, setWinnerResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [authStep, setAuthStep] = useState<AuthStep>('login');
  const [credentials, setCredentials] = useState({ email: '', pass: '' });
  const [mfaCode, setMfaCode] = useState('');
  const [mfaData, setMfaData] = useState<{ factorId?: string; qrCode?: string; challengeId?: string }>({});

  const [isLogged, setIsLogged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const role = await dbService.getMyRole();

          if (role && ['pagos', 'superadmin'].includes(role)) {
            const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const verified = factors?.totp?.find(f => f.status === 'verified');

            if (verified && aal?.currentLevel !== 'aal2') {
              handleInitiateChallenge(verified.id);
            } else {
              setIsLogged(true);
              setUserRole(role);
              await refreshData();
            }
          } else {
            console.warn("Portal Pagos: No autorizado.");
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error("Auth check error:", err);
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, [setUserRole, refreshData]);

  const handleInitiateChallenge = async (factorId: string) => {
    try {
      const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      setMfaData({ factorId, challengeId: challenge.id });
      setAuthStep('mfa-verify');
    } catch (err) {
      await supabase.auth.signOut();
      setAuthStep('login');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    try {
      const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.pass
      });
      if (authErr) throw authErr;

      const role = await dbService.getMyRole();

      if (!role || !['pagos', 'superadmin'].includes(role)) {
        await supabase.auth.signOut();
        throw new Error("No autorizado para portal de pagos.");
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');

      if (!verifiedFactor) {
        // LIMPIEZA: Si hay factores previos no verificados, los quitamos para evitar duplicados de nombre
        if (factors?.totp && factors.totp.length > 0) {
          for (const f of factors.totp) {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }

        const { data: enroll, error: eErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'CambiatuvidaDavid',
          friendlyName: 'Staff'
        });
        if (eErr) throw eErr;
        setMfaData({ factorId: enroll.id, qrCode: enroll.totp.qr_code });
        setAuthStep('mfa-setup');
      } else {
        await handleInitiateChallenge(verifiedFactor.id);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error de acceso');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    try {
      const fId = mfaData.factorId;
      let cId = mfaData.challengeId;

      if (!fId) throw new Error("Factor no identificado");

      if (authStep === 'mfa-setup') {
        const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: fId });
        if (cErr) throw cErr;
        cId = challenge.id;
      }

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: fId,
        challengeId: cId!,
        code: mfaCode
      });
      if (vErr) throw vErr;

      setIsLogged(true);
      await refreshData();
    } catch (err) {
      setAuthError("Código incorrecto.");
      setMfaCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      // LLAMADA A LA NUEVA LÓGICA DE VALIDACIÓN (Edge Function)
      await dbService.updatePurchaseStatus(id, action);
      await refreshData();
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = async () => {
    await dbService.signOut();
    setIsLogged(false);
    setUserRole(null);
    setAuthStep('login');
    navigate('/');
  };

  const handleSearchWinner = async () => {
    if (!searchRaffleId || !searchTicket) return;
    setIsSearching(true);
    setWinnerResult(null);
    try {
      const res = await dbService.searchTicketWinner(searchRaffleId, Number(searchTicket));
      setWinnerResult(res || 'no-found');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  if (checking) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!isLogged) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#f8fafc] px-4">
        <div className="bg-white p-10 md:p-14 rounded-[4rem] max-w-md w-full border border-blue-100 shadow-2xl space-y-10">
          <div className="text-center space-y-4">
            <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden mx-auto shadow-2xl border-4 border-white">
              <img src="/logo_full.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic">Personal de Pagos</h1>
          </div>

          {authError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase text-center">⚠️ {authError}</div>}

          {authStep === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <Input label="Email Staff" type="email" value={credentials.email} onChange={e => setCredentials({ ...credentials, email: e.target.value })} required />
              <Input label="Contraseña" type="password" value={credentials.pass} onChange={e => setCredentials({ ...credentials, pass: e.target.value })} required />
              <Button type="submit" disabled={isLoading} fullWidth variant="blue" className="py-6 text-xl">Ingresar</Button>
            </form>
          )}

          {(authStep === 'mfa-setup' || authStep === 'mfa-verify') && (
            <form onSubmit={handleVerifyMfa} className="space-y-8 animate-in fade-in">
              {authStep === 'mfa-setup' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-6 rounded-3xl border-4 border-slate-50 shadow-inner flex justify-center items-center w-full max-w-[280px] mx-auto">
                    <img src={mfaData.qrCode} alt="QR Code MFA" className="w-full h-auto" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Escanea con Google Authenticator</p>
                </div>
              )}
              <Input label="Código 2FA" type="text" maxLength={6} placeholder="000000" className="text-center text-4xl font-black" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))} required />
              <Button type="submit" disabled={isLoading || mfaCode.length < 6} fullWidth variant="blue" className="py-6 text-xl">Confirmar</Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 max-w-7xl mx-auto px-4 space-y-12">
      {authError && (
        <div className="bg-red-50 text-red-600 p-6 rounded-[2rem] border border-red-100 flex items-center justify-between group animate-in slide-in-from-top">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <span className="font-black text-xs uppercase tracking-widest">{authError}</span>
          </div>
          <button onClick={() => setAuthError(null)} className="opacity-40 hover:opacity-100 text-[10px] font-black uppercase tracking-widest">Cerrar</button>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-100 pb-12 gap-6">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-black text-[#0f172a] tracking-tighter uppercase italic">Conciliación</h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Staff: <span className="text-blue-600">{userRole?.toUpperCase()}</span> • {purchases.length} Pendientes</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => refreshData()} variant="ghost">Actualizar</Button>
          <Button onClick={handleLogout} variant="danger">Salir</Button>
        </div>
      </div>

      {/* 🏆 SECCIÓN: BUSCADOR DE GANADORES (REDESIGN) */}
      <div className="bg-white/40 backdrop-blur-xl p-10 md:p-14 rounded-[4rem] shadow-xl shadow-blue-900/5 border-4 border-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors duration-700"></div>

        <div className="relative flex flex-col lg:flex-row gap-12 items-start lg:items-center">
          <div className="space-y-4 max-w-sm">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200">
              <span className="flex h-2 w-2 rounded-full bg-white animate-pulse"></span>
              Herramienta Admin
            </div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-800 leading-none">Consultar Ganador</h2>
            <p className="text-slate-500 text-sm font-bold leading-relaxed">Localiza al instante el poseedor de cualquier número vendido.</p>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Selecciona el Sorteo</label>
              <div className="relative group">
                <select
                  className="w-full bg-white border-4 border-slate-50 rounded-3xl px-6 py-5 font-black text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none shadow-sm cursor-pointer"
                  value={searchRaffleId}
                  onChange={e => setSearchRaffleId(e.target.value)}
                >
                  <option value="">Elegir rifa...</option>
                  {raffles.map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Número de Ticket</label>
              <Input
                type="number"
                placeholder="Ej: 0543"
                className="text-2xl font-black tracking-tighter py-5 px-6 border-4"
                value={searchTicket}
                onChange={e => setSearchTicket(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleSearchWinner}
                className="w-full py-6 text-xl font-black rounded-3xl shadow-xl shadow-blue-200"
                variant="blue"
                disabled={isSearching || !searchRaffleId || !searchTicket}
              >
                {isSearching ? (
                  <span className="flex items-center gap-3">
                    <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Buscando...
                  </span>
                ) : 'Localizar Poseedor'}
              </Button>
            </div>
          </div>
        </div>

        {/* RESULTADO DE BÚSQUEDA FLUIDO */}
        {winnerResult && (
          <div className="mt-12 pt-12 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-500">
            {winnerResult === 'no-found' ? (
              <div className="text-center py-10 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No se encontró poseedor o el ticket no está vendido</p>
              </div>
            ) : (
              <div className="bg-blue-600 p-8 md:p-14 rounded-[4rem] text-white shadow-2xl shadow-blue-500/30 flex flex-col md:flex-row justify-between gap-12 relative overflow-hidden group/result">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>

                <div className="space-y-8 relative">
                  <div className="inline-flex px-6 py-2 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/30">
                    Ganador Identificado ✓
                  </div>
                  <div className="space-y-2">
                    <p className="text-blue-200 font-black uppercase text-[10px] tracking-[0.3em]">Cédula: {winnerResult.national_id}</p>
                    <h3 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">{winnerResult.full_name}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:min-w-[480px] relative">
                  <div className="space-y-4 bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] border border-white/20 hover:bg-white/20 transition-all duration-300">
                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">WhatsApp Directo</p>
                    <a href={`https://wa.me/${winnerResult.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-5 group/wa">
                      <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-blue-600 shadow-xl group-hover/wa:scale-110 transition-transform duration-300">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.481 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.996-.001-3.951-.5-5.688-1.448l-6.305 1.656zm6.547-3.892c1.556.924 3.485 1.487 5.391 1.488 5.733 0 10.398-4.664 10.401-10.397.002-2.78-1.082-5.392-3.048-7.36s-4.577-3.049-7.359-3.049c-5.731 0-10.397 4.665-10.398 10.397 0 1.979.527 3.91 1.529 5.59l-.993 3.626 3.877-1.019zm11.232-6.582c-.319-.16-1.887-.931-2.181-1.038-.295-.108-.51-.16-.723.16-.214.32-.83.83-1.021 1.038-.192.208-.384.234-.703.075-.319-.16-1.348-.497-2.568-1.587-.948-.846-1.59-1.891-1.775-2.211-.184-.32-.02-.493.14-.652.143-.144.319-.374.479-.56.16-.186.213-.32.32-.534.107-.213.053-.4-.027-.56-.08-.16-.723-1.741-.992-2.388-.261-.634-.526-.547-.723-.547-.186-.006-.4-.006-.613-.006s-.559.08-.851.4c-.292.32-1.117 1.094-1.117 2.668s1.144 3.1 1.304 3.307c.16.208 2.25 3.434 5.449 4.815.762.328 1.355.525 1.817.671.765.243 1.46.208 2.01.127.613-.09 1.887-.771 2.153-1.516.267-.745.267-1.383.186-1.516-.081-.132-.295-.213-.615-.373z" /></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-2xl tracking-tighter">{winnerResult.whatsapp}</span>
                        <span className="text-[10px] font-black uppercase opacity-60">Ponerse en contacto</span>
                      </div>
                    </a>
                  </div>
                  <div className="space-y-4 bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] border border-white/20 hover:bg-white/20 transition-all duration-300">
                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Correo Electrónico</p>
                    <div className="flex flex-col gap-1">
                      <span className="font-black text-xl tracking-tighter truncate max-w-[180px] md:max-w-none">{winnerResult.email}</span>
                      <span className="text-[10px] font-black uppercase opacity-60">Historial enviado</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
              <tr>
                <th className="px-12 py-8">Comprador</th>
                <th className="px-12 py-8 text-center">Referencia</th>
                <th className="px-12 py-8">Monto</th>
                <th className="px-12 py-8 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-12 py-10">
                    <div className="font-black text-[#0f172a] text-xl tracking-tighter">{p.user}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{p.raffle}</div>
                  </td>
                  <td className="px-12 py-10 text-center">
                    <button onClick={() => setViewingEvidence(p.evidence_url!)} className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden mb-1"><img src={p.evidence_url} className="w-full h-full object-cover" alt="Comprobante" /></button>
                    <div className="text-[9px] font-black text-blue-600">REF: {p.ref}</div>
                  </td>
                  <td className="px-12 py-10">
                    <div className="text-[#0f172a] font-black text-2xl tracking-tighter">{p.amount} BS</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{p.ticketsCount} TICKETS</div>
                  </td>
                  <td className="px-12 py-10 text-right">
                    <div className="flex justify-end gap-3">
                      {processingId === p.id ? <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : (
                        <><button onClick={() => handleAction(p.id, 'approved')} className="bg-green-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase">Aprobar</button>
                          <button onClick={() => handleAction(p.id, 'rejected')} className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase">Rechazar</button></>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {viewingEvidence && <div className="fixed inset-0 z-[60] bg-slate-900/95 flex items-center justify-center p-8" onClick={() => setViewingEvidence(null)}><img src={viewingEvidence} className="max-w-full max-h-full rounded-3xl" alt="Ampliación Comprobante" /></div>}
    </div>
  );
};

export default AdminPagos;
