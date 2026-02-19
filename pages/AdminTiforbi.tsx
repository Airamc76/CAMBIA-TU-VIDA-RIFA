
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRaffles } from '../App';
import { Button, Input } from '../components/UI';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';
import ManageRaffles from './ManageRaffles';
import ManageUsers from './ManageUsers';

type AuthStep = 'login' | 'mfa-setup' | 'mfa-verify';
type ActiveTab = 'raffles' | 'users';

const AdminTiforbi: React.FC = () => {
  const navigate = useNavigate();
  const { setUserRole } = useRaffles();

  const [authStep, setAuthStep] = useState<AuthStep>('login');
  const [activeTab, setActiveTab] = useState<ActiveTab>('raffles');
  const [credentials, setCredentials] = useState({ email: '', pass: '' });
  const [mfaCode, setMfaCode] = useState('');
  const [mfaData, setMfaData] = useState<{ factorId?: string; qrCode?: string; challengeId?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);

  const [isLogged, setIsLogged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // CHEQUEO CRÍTICO DE ROL ROOT
          const role = await dbService.getMyRole();

          if (!role || role !== 'superadmin') {
            console.warn("Portal Root: Usuario no autorizado.");
            await supabase.auth.signOut();
            setChecking(false);
            return;
          }

          const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const verified = factors?.totp?.find(f => f.status === 'verified');

          if (verified && aal?.currentLevel !== 'aal2') {
            handleInitiateChallenge(verified.id);
          } else {
            setIsLogged(true);
            setUserRole('superadmin');
          }
        }
      } catch (err) {
        console.error("Root Auth error:", err);
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, [setUserRole]);

  const handleInitiateChallenge = async (factorId: string) => {
    try {
      const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      setMfaData({ factorId, challengeId: challenge.id });
      setAuthStep('mfa-verify');
    } catch (err) {
      setAuthError("No se pudo iniciar el desafío MFA.");
      await supabase.auth.signOut();
      setAuthStep('login');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    try {
      const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.pass
      });
      if (loginErr) throw loginErr;

      // VALIDACIÓN DE ROL MAESTRO
      const role = await dbService.getMyRole();

      if (!role || role !== 'superadmin') {
        await supabase.auth.signOut();
        throw new Error("No autorizado para portal Root.");
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find(f => f.status === "verified");

      if (!verified) {
        // LIMPIEZA: Evitar error de factor ya existente
        if (factors?.totp && factors.totp.length > 0) {
          for (const f of factors.totp) {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }

        const { data: enroll, error: eErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'CambiatuvidaDavid',
          friendlyName: 'Root Admin'
        });
        if (eErr) throw eErr;
        setMfaData({ factorId: enroll.id, qrCode: enroll.totp.qr_code });
        setAuthStep('mfa-setup');
      } else {
        await handleInitiateChallenge(verified.id);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Credenciales Root inválidas');
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

      if (!fId) throw new Error("Factor de seguridad perdido.");

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
      setUserRole('superadmin');
    } catch (err) {
      setAuthError("Código incorrecto o expirado.");
      setMfaCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await dbService.signOut();
    setIsLogged(false);
    setAuthStep('login');
    setUserRole(null);
    setCredentials({ email: '', pass: '' });
    setMfaCode('');
    navigate('/');
  };

  if (checking) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!isLogged) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#050810] px-4">
        <div className="bg-[#0c1222] p-8 md:p-12 rounded-[4rem] max-w-sm w-full border border-white/5 shadow-2xl space-y-10 animate-in zoom-in duration-500">
          <div className="text-center space-y-4">
            <div className="w-28 h-28 rounded-[2.5rem] overflow-hidden mx-auto shadow-2xl border-4 border-white/10">
              <img src="/brand_logo_final.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                {authStep === 'login' ? 'Acceso Maestro' : 'Doble Factor'}
              </h1>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em]">ADMINISTRACIÓN CENTRAL</p>
            </div>
          </div>

          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 p-5 rounded-3xl text-[10px] font-black uppercase tracking-widest text-center animate-in shake duration-500 shadow-xl">⚠️ {authError}</div>}

          {authStep === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" placeholder="Email Root" className="w-full bg-[#050810] border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-blue-500/50 text-sm transition-all" value={credentials.email} onChange={e => setCredentials({ ...credentials, email: e.target.value })} required />
              <input type="password" placeholder="Master Key" className="w-full bg-[#050810] border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-blue-500/50 text-sm transition-all" value={credentials.pass} onChange={e => setCredentials({ ...credentials, pass: e.target.value })} required />
              <Button type="submit" disabled={isLoading} fullWidth variant="blue" className="py-5">Ingresar Root</Button>
            </form>
          )}

          {(authStep === 'mfa-setup' || authStep === 'mfa-verify') && (
            <form onSubmit={handleVerifyMfa} className="space-y-8 animate-in fade-in slide-in-from-right">
              {authStep === 'mfa-setup' && (
                <div className="flex flex-col items-center gap-6">
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl flex justify-center items-center w-64 h-64 mx-auto">
                    <img src={mfaData.qrCode} alt="QR Code MFA" className="w-full h-auto" />
                  </div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest text-center px-4">Enlaza tu dispositivo móvil</p>
                </div>
              )}
              <Input type="text" maxLength={6} placeholder="000000" className="text-center text-3xl font-black bg-[#050810] text-white" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))} required />
              <Button type="submit" disabled={isLoading || mfaCode.length < 6} fullWidth variant="blue" className="py-5">Verificar</Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 mb-12">
        <div className="bg-white p-8 rounded-[3.5rem] border border-blue-50 shadow-xl flex flex-col lg:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white font-black text-2xl">SA</div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>Maestro Online</span>
              <div className="text-slate-900 font-black tracking-tight text-xl">Panel Root SuperAdmin</div>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-[2rem]">
            <button onClick={() => setActiveTab('raffles')} className={`px-10 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest ${activeTab === 'raffles' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400'}`}>Sorteos</button>
            <button onClick={() => setActiveTab('users')} className={`px-10 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400'}`}>Usuarios</button>
          </div>
          <Button onClick={handleLogout} variant="danger" className="px-8 rounded-2xl text-[10px] uppercase tracking-widest">Salir Root</Button>
        </div>
      </div>
      {activeTab === 'raffles' ? <ManageRaffles /> : <ManageUsers />}
    </div>
  );
};

export default AdminTiforbi;
