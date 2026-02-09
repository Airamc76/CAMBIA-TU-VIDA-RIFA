
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRaffles } from '../App';
import { Button, Input } from '../components/UI';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';

type AuthStep = 'login' | 'mfa-setup' | 'mfa-verify';

const AdminPagos: React.FC = () => {
  const navigate = useNavigate();
  const { purchases, userRole, setUserRole, refreshData, updatePurchaseStatus } = useRaffles();
  
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: adminRow } = await supabase
          .from('admins')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (adminRow && ['pagos', 'superadmin'].includes(adminRow.role)) {
          const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const verified = factors?.totp?.find(f => f.status === 'verified');

          if (verified && aal?.currentLevel !== 'aal2') {
             handleInitiateChallenge(verified.id);
          } else {
            setIsLogged(true);
            setUserRole(adminRow.role);
            await refreshData();
          }
        } else {
          console.warn("Portal Pagos: No autorizado.");
          await supabase.auth.signOut();
        }
      }
      setChecking(false);
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

      const { data: adminRow } = await supabase
        .from('admins')
        .select('role')
        .eq('user_id', auth.user?.id)
        .maybeSingle();

      if (!adminRow || !['pagos', 'superadmin'].includes(adminRow.role)) {
        await supabase.auth.signOut();
        throw new Error("No autorizado para portal de pagos.");
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');

      if (!verifiedFactor) {
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
      alert(err.message);
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

  if (checking) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!isLogged) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#f8fafc] px-4">
        <div className="bg-white p-10 md:p-14 rounded-[4rem] max-w-md w-full border border-blue-100 shadow-2xl space-y-10">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic">Personal de Pagos</h1>
          </div>

          {authError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase text-center">⚠️ {authError}</div>}

          {authStep === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <Input label="Email Staff" type="email" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} required />
              <Input label="Contraseña" type="password" value={credentials.pass} onChange={e => setCredentials({...credentials, pass: e.target.value})} required />
              <Button type="submit" disabled={isLoading} fullWidth variant="blue" className="py-6 text-xl">Ingresar</Button>
            </form>
          )}

          {(authStep === 'mfa-setup' || authStep === 'mfa-verify') && (
            <form onSubmit={handleVerifyMfa} className="space-y-8 animate-in fade-in">
               {authStep === 'mfa-setup' && <div className="bg-white p-3 rounded-3xl border-4 border-slate-50 flex justify-center" dangerouslySetInnerHTML={{ __html: mfaData.qrCode || '' }} />}
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
