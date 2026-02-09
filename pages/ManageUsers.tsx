import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Button, Input, Modal, ConfirmDialog } from '../components/UI';

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState<'create' | 'password' | 'role' | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({ email: '', password: '', role: 'pagos' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resettingMfaId, setResettingMfaId] = useState<string | null>(null);
  const [confirmMfaReset, setConfirmMfaReset] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getAdminUsers();
      setUsers(data || []);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (showModal === 'create') {
        await dbService.createAdminUser(formData);
      } else if (showModal === 'password') {
        await dbService.updateAdminUser({ user_id: selectedUser.id, password: formData.password });
      } else if (showModal === 'role') {
        await dbService.updateAdminUser({ user_id: selectedUser.id, role: formData.role });
      }
      setShowModal(null);
      setFormData({ email: '', password: '', role: 'pagos' });
      await loadUsers();
      setNotification({ type: 'success', msg: 'Operación realizada con éxito' });
    } catch (err: any) {
      setNotification({ type: 'error', msg: err.message || 'Ocurrió un error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetMFA = async (uid: string) => {
    if (!uid) {
      console.error("UID vacío, row mal mapeada");
      return;
    }

    console.log("RESET MFA INITIATED FOR UID:", uid);
    setResettingMfaId(uid);
    try {
      const result = await dbService.resetAdminMFA(uid);
      console.log("RESET MFA SUCCESS:", result);
      setNotification({ type: 'success', msg: "✅ Reset MFA OK: " + (result.message || '2FA desactivado') });
      await loadUsers();
    } catch (err: any) {
      console.error("RESET MFA ERROR:", err);
      setNotification({ type: 'error', msg: "❌ Error: " + (err.message || 'No se pudo resetear el 2FA') });
    } finally {
      setResettingMfaId(null);
      setConfirmMfaReset(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.id?.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-10 animate-in fade-in duration-500 relative">
      {notification && (
        <div className={`fixed top-24 right-4 z-[100] px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl animate-in fade-in slide-in-from-right ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {notification.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Usuarios Staff</h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Gestión centralizada de accesos administrativos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input 
              type="text" 
              placeholder="Buscar por email o ID..." 
              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => { setFormData({ email: '', password: '', role: 'pagos' }); setShowModal('create'); }} variant="blue" className="px-8 py-4">
             Nuevo Admin
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              <tr>
                <th className="px-10 py-8">Email / Identificador</th>
                <th className="px-10 py-8 text-center">Nivel</th>
                <th className="px-10 py-8">Fecha Registro</th>
                <th className="px-10 py-8 text-right">Controles Root</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.map(u => {
                // Resolver UID correctamente
                const uid = u.user_id || u.id || u.uid;
                
                return (
                  <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-10 py-8">
                      <div className="font-black text-slate-900 text-lg">{u.email}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-1 opacity-60 uppercase">{u.id}</div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                        u.role === 'superadmin' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {u.role === 'superadmin' ? 'ROOT' : 'STAFF'}
                      </span>
                    </td>
                    <td className="px-10 py-8">
                      <div className="text-slate-500 font-bold text-sm">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => { setSelectedUser(u); setFormData({...formData, role: u.role}); setShowModal('role'); }} 
                          className="p-3 bg-white border border-slate-100 hover:bg-blue-50 text-blue-600 rounded-2xl transition-all shadow-sm group" 
                          title="Cambiar Rol"
                        >
                          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        </button>
                        <button 
                          onClick={() => { setSelectedUser(u); setFormData({...formData, password: ''}); setShowModal('password'); }} 
                          className="p-3 bg-white border border-slate-100 hover:bg-amber-50 text-amber-600 rounded-2xl transition-all shadow-sm group" 
                          title="Reset Clave"
                        >
                          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                        </button>
                        <button 
                          disabled={resettingMfaId === uid}
                          onClick={() => {
                            console.log("CONFIRM RESET MFA FOR UID:", uid);
                            setConfirmMfaReset(uid);
                          }} 
                          className={`p-3 bg-white border border-slate-100 hover:bg-rose-50 text-rose-600 rounded-2xl transition-all shadow-sm group ${resettingMfaId === uid ? 'opacity-50 cursor-not-allowed' : ''}`} 
                          title="Reset 2FA"
                        >
                          {resettingMfaId === uid ? (
                             <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                             <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isLoading && (
            <div className="py-20 flex justify-center bg-slate-50/50">
               <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {!isLoading && filteredUsers.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-black uppercase tracking-[0.5em] italic">Sin coincidencias</div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmMfaReset}
        onClose={() => setConfirmMfaReset(null)}
        onConfirm={() => {
          if (confirmMfaReset) {
            console.log("Confirmación aceptada, llamando handleResetMFA...");
            handleResetMFA(confirmMfaReset);
          }
        }}
        title="¿Resetear Seguridad 2FA?"
        message="El usuario perderá el acceso a su dispositivo de autenticación actual y deberá configurar uno nuevo en su próximo inicio de sesión. Esta acción es inmediata."
        confirmText="Confirmar Reset"
        variant="danger"
      />

      <Modal 
        isOpen={!!showModal} 
        onClose={() => setShowModal(null)} 
        title={
            showModal === 'create' ? 'Crear Administrador' : 
            showModal === 'password' ? 'Resetear Contraseña' : 'Cambiar Rol'
        }
      >
        <form onSubmit={handleAction} className="space-y-8 p-2">
          {showModal === 'create' && (
            <>
              <div className="space-y-4">
                <Input label="Email Oficial" type="email" placeholder="staff@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                <Input label="Contraseña Inicial" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Designar Nivel</label>
                <select className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-black text-sm" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="pagos">Staff de Pagos</option>
                  <option value="superadmin">SuperAdministrador (ROOT)</option>
                </select>
              </div>
            </>
          )}

          {showModal === 'password' && (
            <Input label="Nueva Contraseña Maestra" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required autoFocus />
          )}

          {showModal === 'role' && (
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Actualizar Privilegios</label>
                <select className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-black text-sm" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="pagos">Staff de Pagos</option>
                  <option value="superadmin">SuperAdministrador (ROOT)</option>
                </select>
            </div>
          )}

          <div className="pt-6">
            <Button type="submit" fullWidth disabled={isSubmitting} variant="blue" className="py-6 text-xl">
              {isSubmitting ? 'Procesando...' : 'Confirmar Operación'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManageUsers;