
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRaffles } from '../App';
import { Button, Input } from '../components/UI';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';

type AuthStep = 'login' | 'mfa-setup' | 'mfa-verify';

const AdminPagos: React.FC = () => {
  const navigate = useNavigate();
  const { raffles, purchases, userRole, setUserRole, refreshData } = useRaffles();

  // --- BUSCADOR DE GANADORES ---
  const [searchRaffleId, setSearchRaffleId] = useState('');
  const [searchTicket, setSearchTicket] = useState('');
  const [winnerResult, setWinnerResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [searchIdResult, setSearchIdResult] = useState<any>(null);
  const [isValidatingId, setIsValidatingId] = useState(false);

  // --- ESTADOS DE VISIBILIDAD DE PANELES ---
  const [showWinnerSearch, setShowWinnerSearch] = useState(false);
  const [showIdSearch, setShowIdSearch] = useState(false);

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

  // --- NUEVAS ESTADO DASHBOARD ---
  const [activeTab, setActiveTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado'>('todos');
  const [raffleFilter, setRaffleFilter] = useState<string>('');
  const [stats, setStats] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0, totalAmountToday: 0 });
  const [historyPurchases, setHistoryPurchases] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  // --- PANEL HISTORIAL POR DÍA ---
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [dailyHistory, setDailyHistory] = useState<any[]>([]);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

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
              await handleFetchData();
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
  }, [setUserRole]);

  const handleFetchData = async () => {
    setLocalLoading(true);
    try {
      await refreshData(); // Actualiza pendientes en el context global
      const [s, hApproved, hRejected, daily] = await Promise.all([
        dbService.getAdminStats(),
        dbService.getPurchaseRequests('approved'),
        dbService.getPurchaseRequests('rejected'),
        dbService.getDailyHistory()
      ]);
      setStats(s);
      setHistoryPurchases([...hApproved, ...hRejected].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setDailyHistory(daily);
      // Expandir automáticamente el día de hoy
      if (daily.length > 0) {
        setExpandedDays(prev => ({ ...prev, [daily[0].dateKey]: true }));
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLocalLoading(false);
    }
  };

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
      await dbService.updatePurchaseStatus(id, action);
      await handleFetchData();
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

  const handleValidateId = async () => {
    if (!searchId.trim()) return;
    setIsValidatingId(true);
    setSearchIdResult(null);
    try {
      const res = await dbService.getPurchaseById(searchId.trim());
      setSearchIdResult(res || 'no-found');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsValidatingId(false);
    }
  };

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!isLogged) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#f8fafc] px-4">
        <div className="bg-white p-10 md:p-14 rounded-[4rem] max-w-md w-full border border-blue-100 shadow-2xl space-y-10">
          <div className="text-center space-y-4">
            <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden mx-auto shadow-2xl border-4 border-white">
              <img src="/brand_logo_final.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic">Personal de Pagos</h1>
          </div>

          {authError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase text-center">⚠️ {authError}</div>
          )}

          {authStep === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <Input
                label="Email Staff"
                type="email"
                value={credentials.email}
                onChange={e => setCredentials({ ...credentials, email: e.target.value })}
                required
              />
              <Input
                label="Contraseña"
                type="password"
                value={credentials.pass}
                onChange={e => setCredentials({ ...credentials, pass: e.target.value })}
                required
              />
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
              <Input
                label="Código 2FA"
                type="text"
                maxLength={6}
                placeholder="000000"
                className="text-center text-4xl font-black"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                required
              />
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-100 pb-12 gap-8 relative">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
            Panel de Tesorería v2.0
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-[#0f172a] tracking-tight uppercase italic leading-none">Gestión de <span className="text-blue-600">Pagos</span></h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[11px] flex items-center gap-2">
            Staff: <span className="text-slate-900 border-b-2 border-blue-200">{userRole?.toUpperCase()}</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            {stats.pending} Por Conciliar
            <span className="ml-4 text-[9px] text-red-400">
              Debug: P{purchases.length} / S{stats.pending}
            </span>
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <Button
            onClick={() => setShowHistoryDrawer(true)}
            variant="ghost"
            className="flex-1 md:flex-none border border-slate-100 bg-white hover:bg-slate-50 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Historial por Día
          </Button>
          <Button onClick={() => handleFetchData()} variant="ghost" className="flex-1 md:flex-none border border-slate-100 bg-white hover:bg-slate-50 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refrescar
          </Button>
          <Button onClick={handleLogout} variant="danger" className="flex-1 md:flex-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* 📊 SECCIÓN: ESTADÍSTICAS RÁPIDAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Pendientes', value: stats.pending, sub: 'Acción requerida', color: 'bg-amber-500', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Aprobados Hoy', value: stats.approvedToday, sub: 'Transacciones exitosas', color: 'bg-green-500', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Ingresos Hoy', value: `${stats.totalAmountToday} BS`, sub: 'Volumen operado', color: 'bg-blue-600', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Rechazados Hoy', value: stats.rejectedToday, sub: 'Revisiones fallidas', color: 'bg-rose-500', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group">
            <div className="flex justify-between items-start mb-6">
              <div className={`${item.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon} /></svg>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item.label}</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{item.value}</h3>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 🏆 SECCIÓN: BUSCADOR DE GANADORES (REDESIGN) */}
      <div className="bg-slate-900 p-10 md:p-14 rounded-[4rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-colors duration-700"></div>

        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="space-y-4 max-w-sm text-white">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Herramienta Admin
            </div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Consultar Ganador</h2>
            <p className="text-slate-400 text-sm font-bold leading-relaxed">Localiza al instante el poseedor de cualquier número vendido.</p>
          </div>

          <Button
            onClick={() => setShowWinnerSearch(!showWinnerSearch)}
            variant="blue"
            className="rounded-3xl px-8 py-4 font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-3"
          >
            {showWinnerSearch ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                Ocultar Buscador
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                Abrir Buscador
              </>
            )}
          </Button>
        </div>

        {showWinnerSearch && (
          <div className="relative mt-12 pt-12 border-t border-white/10 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col lg:flex-row gap-8 items-end">
              <div className="flex-1 w-full space-y-3">
                <label className="text-[10px] font-black text-blue-200 uppercase tracking-widest ml-4">Selecciona el Sorteo</label>
                <div className="relative">
                  <select
                    className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-8 py-5 text-lg font-bold text-white outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all appearance-none cursor-pointer"
                    value={searchRaffleId}
                    onChange={e => setSearchRaffleId(e.target.value)}
                  >
                    <option value="" className="bg-slate-900">Elegir campaña...</option>
                    {raffles.map(r => (
                      <option key={r.id} value={r.id} className="bg-slate-900">{r.title}</option>
                    ))}
                  </select>
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                <label className="text-[10px] font-black text-blue-200 uppercase tracking-widest ml-4">Número de Ticket</label>
                <input
                  type="number"
                  placeholder="Ej: 1945"
                  className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-8 py-5 text-2xl font-black text-blue-100 placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-inner"
                  value={searchTicket}
                  onChange={e => setSearchTicket(e.target.value)}
                />
              </div>

              <Button
                onClick={handleSearchWinner}
                className="py-6 px-12 text-xl font-black rounded-3xl shadow-xl hover:scale-105 transition-transform w-full lg:w-auto"
                variant="blue"
                disabled={isSearching || !searchRaffleId || !searchTicket}
              >
                {isSearching ? 'Buscando...' : 'Localizar Poseedor'}
              </Button>
            </div>

            {/* RESULTADO DE BÚSQUEDA */}
            {winnerResult && (
              <div className="mt-12 pt-12 border-t border-white/10 animate-in fade-in slide-in-from-bottom-8 duration-500">
                {winnerResult === 'no-found' ? (
                  <div className="text-center py-10 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10 flex flex-col items-center gap-4">
                    <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No se encontró poseedor o el ticket no está vendido</p>
                  </div>
                ) : (
                  <div className="bg-blue-600 p-8 md:p-14 rounded-[4rem] text-white shadow-2xl flex flex-col gap-10 relative overflow-hidden">
                    {/* ... (resto del contenido del resultado del ganador igual) ... */}
                    <div className="flex flex-col md:flex-row justify-between gap-10">
                      <div className="space-y-6">
                        <div className="inline-flex px-6 py-2 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/30">
                          Ganador Identificado ✓
                        </div>
                        <div className="space-y-2">
                          <p className="text-blue-200 font-black uppercase text-[10px] tracking-[0.3em]">Cédula: {winnerResult.national_id}</p>
                          <h3 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">{winnerResult.full_name}</h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:min-w-[420px]">
                        <div className="space-y-4 bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] border border-white/20">
                          <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">WhatsApp Directo</p>
                          <a href={`https://wa.me/${winnerResult.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-blue-600 shadow-xl">
                              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.481 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.996-.001-3.951-.5-5.688-1.448l-6.305 1.656zm6.547-3.892c1.556.924 3.485 1.487 5.391 1.488 5.733 0 10.398-4.664 10.401-10.397.002-2.78-1.082-5.392-3.048-7.36s-4.577-3.049-7.359-3.049c-5.731 0-10.397 4.665-10.398 10.397 0 1.979.527 3.91 1.529 5.59l-.993 3.626 3.877-1.019zm11.232-6.582c-.319-.16-1.887-.931-2.181-1.038-.295-.108-.51-.16-.723.16-.214.32-.83.83-1.021 1.038-.192.208-.384.234-.703.075-.319-.16-1.348-.497-2.568-1.587-.948-.846-1.59-1.891-1.775-2.211-.184-.32-.02-.493.14-.652.143-.144.319-.374.479-.56.16-.186.213-.32.32-.534.107-.213.053-.4-.027-.56-.08-.16-.723-1.741-.992-2.388-.261-.634-.526-.547-.723-.547-.186-.006-.4-.006-.613-.006s-.559.08-.851.4c-.292.32-1.117 1.094-1.117 2.668s1.144 3.1 1.304 3.307c.16.208 2.25 3.434 5.449 4.815.762.328 1.355.525 1.817.671.765.243 1.46.208 2.01.127.613-.09 1.887-.771 2.153-1.516.267-.745.267-1.383.186-1.516-.081-.132-.295-.213-.615-.373z" /></svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-xl tracking-tighter">{winnerResult.whatsapp}</span>
                              <span className="text-[10px] font-black uppercase opacity-60">Fijar Ganador</span>
                            </div>
                          </a>
                        </div>
                        <div className="space-y-4 bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] border border-white/20">
                          <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Correo Electrónico</p>
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-xl tracking-tighter">{winnerResult.email}</span>
                            <span className="text-[10px] font-black uppercase opacity-60">Enviar Tickets</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FILA DE TICKETS: todos los números, el buscado destacado */}
                    {winnerResult.assigned_numbers && winnerResult.assigned_numbers.length > 0 && (
                      <div className="relative border-t border-white/20 pt-8 space-y-5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Sus números en esta rifa</p>
                          <span className="text-[9px] font-black text-yellow-300 uppercase tracking-widest bg-yellow-400/20 px-3 py-1 rounded-full border border-yellow-400/30">
                            🎯 #{searchTicket} Buscado
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {[...winnerResult.assigned_numbers].sort((a: number, b: number) => a - b).map((num: number) => {
                            const isSearched = String(num) === String(searchTicket);
                            return (
                              <div
                                key={num}
                                className={`relative flex flex-col items-center justify-center rounded-2xl px-4 py-3 transition-all duration-300 ${isSearched
                                  ? 'bg-yellow-400 text-slate-900 shadow-xl shadow-yellow-400/40 scale-110 ring-2 ring-white/60'
                                  : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
                                  }`}
                              >
                                {isSearched && (
                                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-wider bg-yellow-400 text-slate-900 px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                                    ★ Este
                                  </span>
                                )}
                                <span className={`text-[8px] font-black uppercase tracking-widest leading-none mb-0.5 ${isSearched ? 'text-slate-600' : 'text-white/40'}`}>Ticket</span>
                                <span className={`font-black text-lg tracking-tighter leading-none ${isSearched ? 'text-slate-900' : ''}`}>{num}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-900 p-10 md:p-14 rounded-[4rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-colors duration-700"></div>

        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="space-y-4 max-w-sm text-white">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Soporte / Reclamos
            </div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Validar Pago por ID</h2>
            <p className="text-slate-400 text-sm font-bold leading-relaxed">Pega el ID de compra (UUID) para revisar los datos registrados y el comprobante original.</p>
          </div>

          <Button
            onClick={() => setShowIdSearch(!showIdSearch)}
            variant="blue"
            className="rounded-3xl px-8 py-4 font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-3"
          >
            {showIdSearch ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                Ocultar Validador
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                Abrir Validador
              </>
            )}
          </Button>
        </div>

        {showIdSearch && (
          <div className="relative mt-12 pt-12 border-t border-white/10 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col md:flex-row gap-6 w-full">
              <div className="flex-1 relative">
                <input
                  placeholder="Ej: 3139fa64-3978..."
                  className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-8 py-6 text-xl font-mono text-blue-100 placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-inner"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                />
              </div>
              <Button
                onClick={handleValidateId}
                className="py-6 px-12 text-xl font-black rounded-3xl shadow-xl hover:scale-105 transition-transform shrink-0"
                variant="blue"
                disabled={isValidatingId || !searchId}
              >
                {isValidatingId ? 'Verificando...' : 'Buscar Reporte'}
              </Button>
            </div>

            {/* RESULTADO DE VALIDACIÓN ID */}
            {searchIdResult && (
              <div className="mt-12 pt-12 border-t border-white/5 animate-in fade-in slide-in-from-bottom-8 duration-500">
                {searchIdResult === 'no-found' ? (
                  <div className="text-center py-10 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10 flex flex-col items-center gap-4">
                    <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No se encontró ningún reporte con ese ID</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[3rem] p-8 md:p-12 text-slate-900 shadow-2xl flex flex-col gap-10 relative overflow-hidden">
                    <div className="flex flex-col lg:flex-row justify-between gap-10">
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4">
                          <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${searchIdResult.status === 'aprobado' ? 'bg-green-100 text-green-600' :
                            searchIdResult.status === 'rechazado' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                            Estado: {searchIdResult.status}
                          </div>
                          <span className="text-slate-300 font-bold text-xs uppercase tracking-widest">Registrado el {searchIdResult.date}</span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comprador</p>
                          <h3 className="text-4xl font-black tracking-tight">{searchIdResult.user}</h3>
                          <p className="text-base font-bold text-slate-500">DNI: {searchIdResult.dni} • WhatsApp: {searchIdResult.whatsapp}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Pagado</p>
                            <p className="text-2xl font-black text-slate-900">{searchIdResult.amount} BS</p>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Referencia</p>
                            <p className="text-2xl font-black text-slate-900 truncate">{searchIdResult.ref || 'S/N'}</p>
                          </div>
                        </div>

                        <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Campaña / Rifa</p>
                          <p className="text-xl font-black text-blue-900">{searchIdResult.raffle}</p>
                          <p className="text-xs font-bold text-blue-600 uppercase mt-1">ID: {searchIdResult.raffleId}</p>
                        </div>
                      </div>

                      <div className="lg:w-[350px] space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Comprobante Original</p>
                        {searchIdResult.evidence_url ? (
                          <div
                            className="relative aspect-[4/5] rounded-[2rem] border-4 border-slate-50 overflow-hidden shadow-xl cursor-pointer hover:scale-[1.02] transition-transform group/img"
                            onClick={() => setViewingEvidence(searchIdResult.evidence_url)}
                          >
                            <img src={searchIdResult.evidence_url} className="w-full h-full object-cover" alt="Comprobante" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <span className="bg-white text-black px-4 py-2 rounded-full text-[10px] font-black uppercase">Ver Ampliado</span>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[4/5] bg-slate-100 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-slate-400">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <p className="text-[10px] font-black uppercase tracking-widest">Sin imagen</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {searchIdResult.assignedNumbers && searchIdResult.assignedNumbers.length > 0 && (
                      <div className="pt-8 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tickets Asignados ({searchIdResult.assignedNumbers.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {searchIdResult.assignedNumbers.map((n: number) => (
                            <span key={n} className="px-3 py-1 bg-slate-100 rounded-lg text-sm font-black text-slate-700">#{n}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🔍 BARRA DE ACCIÓN: TABS + BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-900/5 p-4 rounded-[2.5rem] border border-slate-100">
        <div className="flex flex-wrap bg-white/50 backdrop-blur-md p-1.5 rounded-3xl border border-white shadow-inner w-full md:w-auto gap-2">
          <button
            onClick={() => { setActiveTab('pendientes'); setStatusFilter('todos'); }}
            className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'pendientes' && statusFilter === 'todos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Pendientes ({stats.pending})
          </button>
          <button
            onClick={() => { setActiveTab('historial'); setStatusFilter('todos'); }}
            className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'historial' && statusFilter === 'todos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Historial ({historyPurchases.length})
          </button>

          <div className="w-px bg-slate-200 mx-2 hidden md:block"></div>

          <button
            onClick={() => setStatusFilter('pendiente')}
            className={`flex-1 md:flex-none px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statusFilter === 'pendiente' ? 'bg-amber-500 text-white shadow-lg' : 'text-amber-500/50 hover:text-amber-500 bg-amber-50/50'}`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('aprobado')}
            className={`flex-1 md:flex-none px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statusFilter === 'aprobado' ? 'bg-green-600 text-white shadow-lg' : 'text-green-600/50 hover:text-green-600 bg-green-50/50'}`}
          >
            Aprobados
          </button>
          <button
            onClick={() => setStatusFilter('rechazado')}
            className={`flex-1 md:flex-none px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statusFilter === 'rechazado' ? 'bg-rose-600 text-white shadow-lg' : 'text-rose-600/50 hover:text-rose-600 bg-rose-50/50'}`}
          >
            Rechazados
          </button>

          <div className="w-px bg-slate-200 mx-2 hidden md:block"></div>

          <div className="relative flex-1 md:flex-none">
            <select
              value={raffleFilter}
              onChange={(e) => setRaffleFilter(e.target.value)}
              className="w-full md:w-48 appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
            >
              <option value="">Todas las rifas</option>
              {raffles.map(r => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div className="relative w-full md:max-w-md group">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, DNI o referencia..."
            className="w-full bg-white border-2 border-slate-50 rounded-[2rem] pl-16 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* 📋 LISTADO DE TRANSACCIONES */}
      <div className="bg-white rounded-[4rem] border border-slate-100 shadow-xl overflow-hidden min-h-[400px]">
        {localLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Sincronizando registros...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.3em]">
                <tr>
                  <th className="px-10 py-6">Comprador / Sorteo</th>
                  <th className="px-10 py-6 text-center">Evidencia</th>
                  <th className="px-10 py-6">Monto & Tickets</th>
                  <th className="px-10 py-6 text-center">Estado</th>
                  <th className="px-10 py-6 text-right">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(activeTab === 'pendientes' && statusFilter === 'todos' ? purchases :
                  statusFilter === 'todos' ? historyPurchases :
                    [...purchases, ...historyPurchases].filter(p => p.status === statusFilter))
                  .filter(p => {
                    const matchesSearch = p.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.dni.includes(searchTerm) ||
                      p.ref.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesRaffle = raffleFilter === '' || p.raffleId === raffleFilter;
                    return matchesSearch && matchesRaffle;
                  })
                  .map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-lg tracking-tight leading-tight">{p.user}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{p.raffle}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <button
                          onClick={() => setViewingEvidence(p.evidence_url!)}
                          className="relative w-14 h-14 rounded-2xl border-2 border-slate-100 overflow-hidden hover:border-blue-500 transition-all shadow-sm group/thumb"
                        >
                          <img src={p.evidence_url!} className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform" alt="Comprobante" />
                          <div className="absolute inset-0 bg-blue-600/0 group-hover/thumb:bg-blue-600/20 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-all">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </div>
                        </button>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-black text-xl tracking-tighter">{p.amount} BS</span>
                          <span className="text-[9px] font-black text-blue-600/60 uppercase tracking-widest">{p.ticketsCount} TICKETS</span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className={`inline-flex px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${p.status === 'pendiente' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          p.status === 'aprobado' ? 'bg-green-50 text-green-600 border-green-100' :
                            'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex justify-end gap-2">
                          {p.status === 'pendiente' ? (
                            processingId === p.id ? (
                              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleAction(p.id, 'approved')}
                                  className="bg-green-600 hover:bg-green-700 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 transition-all active:scale-90"
                                  title="Aprobar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button
                                  onClick={() => handleAction(p.id, 'rejected')}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 w-10 h-10 rounded-xl flex items-center justify-center border border-rose-100 transition-all active:scale-90"
                                  title="Rechazar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </>
                            )
                          ) : (
                            <div className="text-[9px] font-black text-slate-300 uppercase italic">Procesado</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {((activeTab === 'pendientes' ? purchases : historyPurchases).filter(p =>
                  p.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  p.dni.includes(searchTerm) ||
                  p.ref.toLowerCase().includes(searchTerm.toLowerCase())
                ).length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                          <p className="font-black text-xs uppercase tracking-widest">No hay registros que coincidan</p>
                        </div>
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {
        viewingEvidence && (
          <div
            className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
            onClick={() => setViewingEvidence(null)}
          >
            <div className="relative max-w-5xl w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setViewingEvidence(null)}
                className="absolute top-4 right-4 md:-top-4 md:-right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-2xl hover:scale-110 transition-transform z-[70]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <img
                src={viewingEvidence}
                className="max-w-full max-h-full rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] object-contain transition-all animate-in zoom-in-95 duration-500"
                alt="Ampliación Comprobante"
              />
            </div>
          </div>
        )
      }

      {/* 📅 DRAWER: HISTORIAL POR DÍA */}
      {
        showHistoryDrawer && (
          <div className="fixed inset-0 z-[70] flex justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowHistoryDrawer(false)}
            />
            {/* Panel deslizante derecha */}
            <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/80 backdrop-blur-md shrink-0">
                <div className="space-y-1">
                  <h2 className="text-xl font-black italic uppercase tracking-tight text-slate-900">Historial por Día</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingresos aprobados en BS</p>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Contenido scrolleable */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {dailyHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                    <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <p className="text-xs font-black uppercase tracking-widest">Sin historial aún</p>
                  </div>
                ) : (
                  dailyHistory.map((day) => (
                    <div key={day.dateKey} className="rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                      {/* Cabecera del día (clickable) */}
                      <button
                        className="w-full flex items-center justify-between px-6 py-4 bg-white hover:bg-slate-50 transition-colors"
                        onClick={() => setExpandedDays(prev => ({ ...prev, [day.dateKey]: !prev[day.dateKey] }))}
                      >
                        <div className="text-left space-y-0.5">
                          <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider capitalize leading-none">{day.date}</p>
                          <p className="text-[10px] font-bold text-slate-400">{day.items.length} transacciones</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-lg font-black text-green-600 tracking-tighter leading-none">{day.totalBs.toLocaleString()} BS</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{day.count} aprobados</p>
                          </div>
                          <div className={`w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 transition-transform duration-200 ${expandedDays[day.dateKey] ? 'rotate-180' : ''}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                      </button>

                      {/* Filas del día */}
                      {expandedDays[day.dateKey] && (
                        <div className="border-t border-slate-50 divide-y divide-slate-50">
                          {day.items.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                              {/* Status dot */}
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.status === 'approved' ? 'bg-green-500' : 'bg-rose-400'
                                }`} />
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-900 text-sm truncate leading-tight">{item.user}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{item.raffle}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`font-black text-sm tracking-tighter ${item.status === 'approved' ? 'text-green-600' : 'text-rose-400 line-through opacity-60'
                                  }`}>{item.amount.toLocaleString()} BS</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{item.time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default AdminPagos;
