
import React, { useState, useEffect } from 'react';
import { Button } from './UI';
import { dbService } from '../services/dbService';
import { useRaffles } from '../App';

interface BlessedNumber {
    blessed_id: string;
    number: number;
    is_reserved: boolean;
    raffle_id: string;
    raffle_title: string;
    owners: {
        raffle_title: string;
        user_name: string;
        status: string;
        whatsapp: string;
    }[];
}

const AdminBlessedNumbers: React.FC = () => {
    const { raffles } = useRaffles();
    const [blessed, setBlessed] = useState<BlessedNumber[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showPanel, setShowPanel] = useState(false);

    // Form state
    const [newNumber, setNewNumber] = useState('');
    const [selectedRaffle, setSelectedRaffle] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const fetchBlessed = async () => {
        setIsLoading(true);
        try {
            const data = await dbService.getBlessedNumbers();
            setBlessed(data);
        } catch (error) {
            console.error("Error fetching blessed numbers:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await dbService.toggleBlessedNumber(id, !currentStatus);
            await fetchBlessed();
        } catch (error) {
            alert("Error al actualizar el estado del número.");
        }
    };

    const handleAddBlessed = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNumber || !selectedRaffle) return;

        setIsAdding(true);
        try {
            await dbService.addBlessedNumber(parseInt(newNumber), selectedRaffle, 'Reserva Manual');
            setNewNumber('');
            await fetchBlessed();
        } catch (error: any) {
            alert(error.message || "Error al agregar el número bendecido.");
        } finally {
            setIsAdding(false);
        }
    };

    useEffect(() => {
        fetchBlessed();
        if (raffles.length > 0 && !selectedRaffle) {
            setSelectedRaffle(raffles[0].id);
        }
    }, [raffles]);

    return (
        <div className="max-w-7xl mx-auto px-4 mb-8">
            <div className="bg-amber-950/20 border-2 border-amber-500/30 rounded-[3rem] p-8 md:p-10 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <svg className="w-24 h-24 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" /></svg>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 rounded-full text-[10px] font-black uppercase tracking-widest text-white mb-4 shadow-lg shadow-amber-500/20">
                            CONTROL DE AZAR
                        </div>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-amber-100">Números Bendecidos</h2>
                        <p className="text-amber-300/60 text-sm font-bold mt-1">Reserva números específicos por rifa y audita a los ganadores.</p>
                    </div>

                    <div className="flex gap-4">
                        <Button
                            onClick={fetchBlessed}
                            disabled={isLoading}
                            variant="blue"
                            className="rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-amber-600 hover:bg-amber-500 shadow-xl"
                        >
                            {isLoading ? 'Consultando...' : 'Sincronizar'}
                        </Button>
                        <Button
                            onClick={() => setShowPanel(!showPanel)}
                            variant="blue"
                            className="rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-amber-500 hover:bg-amber-400 shadow-xl shadow-amber-500/20"
                        >
                            {showPanel ? 'Ocultar Panel' : `Abrir Panel (${blessed.length})`}
                        </Button>
                    </div>
                </div>

                {showPanel && (
                    <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-500 space-y-10">
                        {/* Formulario para añadir */}
                        <form onSubmit={handleAddBlessed} className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-amber-500/10 flex flex-col lg:flex-row gap-6 items-end relative z-10">
                            <div className="flex-1 space-y-3 w-full">
                                <label className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest ml-4">Seleccionar Rifa</label>
                                <select
                                    className="w-full bg-black/40 border-2 border-white/5 rounded-3xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                                    value={selectedRaffle}
                                    onChange={(e) => setSelectedRaffle(e.target.value)}
                                    required
                                >
                                    {raffles.map(r => (
                                        <option key={r.id} value={r.id} className="bg-slate-900">{r.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full lg:w-48 space-y-3">
                                <label className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest ml-4">Número a Bendecir</label>
                                <input
                                    type="text"
                                    maxLength={4}
                                    placeholder="Ej: 0526"
                                    className="w-full bg-black/40 border-2 border-white/5 rounded-3xl px-6 py-4 text-xl font-black text-white placeholder:text-slate-700 outline-none focus:border-amber-500 transition-all"
                                    value={newNumber}
                                    onChange={e => setNewNumber(e.target.value.replace(/\D/g, ''))}
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isAdding || !newNumber || !selectedRaffle}
                                className="w-full lg:w-48 py-5 bg-amber-500 hover:bg-amber-400 text-white font-black uppercase text-[10px] tracking-widest rounded-3xl shadow-xl shadow-amber-500/10"
                            >
                                {isAdding ? 'Reservando...' : 'Bendecir Número'}
                            </Button>
                        </form>

                        {/* Cuadrícula de números */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                            {blessed.map((bn) => (
                                <div key={bn.blessed_id} className="bg-slate-900/60 border border-amber-500/20 p-6 rounded-[2.5rem] hover:border-amber-500/50 transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <p className="text-[8px] font-black text-amber-500/40 uppercase tracking-widest mb-1 truncate max-w-[150px]">
                                                {bn.raffle_title || 'Global'}
                                            </p>
                                            <p className="text-5xl font-black text-white tracking-widest group-hover:text-amber-400 transition-colors">
                                                {bn.number.toString().padStart(4, '0')}
                                            </p>
                                        </div>
                                        <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${bn.is_reserved
                                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                : 'bg-green-500/20 text-green-400 border-green-500/30'
                                            }`}>
                                            {bn.is_reserved ? '⚠️ RESERVADO' : '✅ LIBRE PODER'}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Tenedores en esta Rifa ({bn.owners.length})</p>
                                            {bn.owners.length > 0 ? (
                                                <div className="space-y-3">
                                                    {bn.owners.map((owner, idx) => (
                                                        <div key={idx} className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                                            <p className="text-[10px] text-white font-black uppercase truncate">{owner.user_name}</p>
                                                            <div className="flex justify-between items-center mt-1">
                                                                <p className="text-[8px] text-amber-400/60 font-black uppercase truncate max-w-[120px]">{owner.raffle_title}</p>
                                                                <span className="text-[8px] text-slate-500 font-bold">{owner.whatsapp}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-4 text-center border-2 border-dashed border-white/5 rounded-2xl text-[9px] text-slate-600 font-black uppercase">
                                                    Nadie tiene este número
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleToggle(bn.blessed_id, bn.is_reserved)}
                                            className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${bn.is_reserved
                                                    ? 'bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20'
                                                    : 'bg-slate-800 hover:bg-amber-700 text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            {bn.is_reserved ? 'Liberar para Sorteo' : 'Reservar Número'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminBlessedNumbers;
