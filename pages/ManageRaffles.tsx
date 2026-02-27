
import React, { useState, useEffect } from 'react';
import { useRaffles } from '../App';
import { Input, Button, ConfirmDialog, BadgeStatus } from '../components/UI';
import { Raffle, RaffleStatus } from '../types';
import { dbService } from '../services/dbService';

const ManageRaffles: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const { raffles, addRaffle, deleteRaffle, updateRaffle, refreshData } = useRaffles();

  const initialFormState = {
    title: '',
    ticket_price: 0,
    currency: 'Bs',
    cover_url: '',
    status: RaffleStatus.ACTIVA,
    sold_tickets: 0,
    total_tickets: 1000,
    description: '',
    prizes_input: '',
    draw_date: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleSaveRaffle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalCoverUrl = formData.cover_url;
      if (selectedFile) {
        finalCoverUrl = await dbService.uploadRaffleImage(selectedFile);
      }

      const prizesArray = formData.prizes_input.split('\n').map(p => p.trim()).filter(p => p.length > 0);

      const rafflePayload: Partial<Raffle> = {
        title: formData.title,
        ticket_price: formData.ticket_price,
        currency: formData.currency,
        cover_url: finalCoverUrl || 'https://picsum.photos/seed/default/800/600',
        status: formData.status,
        total_tickets: formData.total_tickets,
        description: formData.description,
        draw_date: formData.draw_date ? new Date(formData.draw_date).toISOString() : undefined,
        prizes: prizesArray,
      };

      if (editingId) {
        await updateRaffle({ ...rafflePayload, id: editingId } as Raffle);
        setNotification({ type: 'success', msg: 'Actualizado' });
      } else {
        await addRaffle({ ...rafflePayload, sold_tickets: 0 } as Raffle);
        setNotification({ type: 'success', msg: 'Creado' });
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(initialFormState);
      setSelectedFile(null);
    } catch (err: any) {
      setNotification({ type: 'error', msg: 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteRaffle(confirmDelete);
      setNotification({ type: 'success', msg: 'Sorteo eliminado' });
    } catch (err) {
      setNotification({ type: 'error', msg: 'Error al eliminar' });
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleEditClick = (raffle: Raffle) => {
    setEditingId(raffle.id);
    setFormData({
      title: raffle.title,
      ticket_price: raffle.ticket_price,
      currency: raffle.currency || 'Bs',
      cover_url: raffle.cover_url,
      status: raffle.status,
      description: raffle.description,
      prizes_input: raffle.prizes?.join('\n') || '',
      draw_date: raffle.draw_date || '',
      total_tickets: raffle.total_tickets,
      sold_tickets: raffle.sold_tickets
    });
    setShowForm(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-16 animate-in fade-in duration-500">
      {notification && (
        <div className={`fixed top-24 right-4 z-[100] px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl animate-in fade-in slide-in-from-right ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {notification.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end gap-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Gestión de Sorteos</h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Configuración avanzada de premios y disponibilidad</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(initialFormState); }} variant="blue" className="px-10 py-4 text-lg">
          {showForm ? 'Cerrar Formulario' : 'Crear Nuevo Sorteo'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white p-12 md:p-16 rounded-[4rem] border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-300">
          <form onSubmit={handleSaveRaffle} className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2">
                <Input label="Nombre de la Rifa" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <Input label="Precio Ticket" type="number" required value={formData.ticket_price} onChange={e => setFormData({ ...formData, ticket_price: Number(e.target.value) })} />

              <div className="flex flex-col gap-2 lg:col-span-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-widest">Descripción</label>
                <textarea className="bg-white border border-slate-200 rounded-3xl px-6 py-5 text-slate-900 min-h-[150px] outline-none focus:ring-4 focus:ring-blue-500/10 font-medium" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-widest">Premios (Uno por línea)</label>
                <textarea className="bg-slate-50 border border-slate-200 rounded-3xl px-6 py-5 text-slate-900 font-bold min-h-[150px] outline-none focus:ring-4 focus:ring-blue-500/10" value={formData.prizes_input} onChange={e => setFormData({ ...formData, prizes_input: e.target.value })} />
              </div>

              <Input label="Fecha del Sorteo" type="date" value={formData.draw_date} onChange={e => setFormData({ ...formData, draw_date: e.target.value })} />
              <Input label="Tickets Totales" type="number" value={formData.total_tickets} onChange={e => setFormData({ ...formData, total_tickets: Number(e.target.value) })} />

              <div className="flex flex-col gap-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-widest">Imagen de Portada</label>
                <input type="file" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-black uppercase text-slate-500 file:bg-slate-900 file:text-white file:border-0 file:rounded-xl file:px-4 file:py-1.5 file:mr-4 file:cursor-pointer" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-widest">Estado</label>
                <select className="bg-white border border-slate-200 rounded-2xl px-4 py-3 font-bold" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as RaffleStatus })}>
                  <option value={RaffleStatus.ACTIVA}>Activa</option>
                  <option value={RaffleStatus.PAUSADA}>Pausada</option>
                  <option value={RaffleStatus.CERRADA}>Cerrada</option>
                  <option value={RaffleStatus.SORTEADA}>Sorteada</option>
                  <option value={RaffleStatus.AGOTADA}>Agotada</option>
                  <option value={RaffleStatus.OCULTA}>Oculta (Borrador)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-5 pt-10 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setShowForm(false)} className="px-10">Cancelar</Button>
              <Button type="submit" disabled={isSaving} variant="blue" className="px-12 py-4 font-black text-lg">
                {isSaving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Sorteo'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {raffles.filter(r => r.status !== RaffleStatus.ELIMINADA).map(r => (
          <div key={r.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-200 hover:shadow-2xl transition-all group flex flex-col gap-8 shadow-sm">
            <div className="relative h-56 rounded-[2.5rem] overflow-hidden bg-slate-100">
              <img src={r.cover_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute top-6 right-6">
                <BadgeStatus status={r.status} />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="font-black text-2xl text-slate-900 tracking-tighter truncate">{r.title}</h3>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-400">{r.sold_tickets} / {r.total_tickets} VENDIDOS</span>
                <span className="text-blue-600 font-black">{r.ticket_price} {r.currency}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="ghost" onClick={() => handleEditClick(r)} className="text-[10px] uppercase tracking-widest border border-slate-100">Editar</Button>
              <Button variant="danger" onClick={() => setConfirmDelete(r.id)} className="text-[10px] uppercase tracking-widest">Eliminar</Button>
            </div>
          </div>
        ))}
        {raffles.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-[0.5em] italic">No hay sorteos registrados</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="¿Eliminar Sorteo?"
        message="Esta acción no se puede deshacer y borrará permanentemente los datos asociados."
        confirmText="Sí, Eliminar"
        variant="danger"
      />
    </div>
  );
};

export default ManageRaffles;
