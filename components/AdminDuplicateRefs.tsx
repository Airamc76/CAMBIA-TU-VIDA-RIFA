
import React, { useState, useEffect } from 'react';
import { Button } from './UI';
import { dbService } from '../services/dbService';

interface DuplicateRef {
    reference: string;
    occurrence_count: number;
    latest_user: string;
    raffle_titles: string[];
}

const AdminDuplicateRefs: React.FC<{ onSearchRef: (ref: string) => void }> = ({ onSearchRef }) => {
    const [duplicates, setDuplicates] = useState<DuplicateRef[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const fetchDuplicates = async () => {
        setIsLoading(true);
        try {
            const data = await dbService.getDuplicateReferences();
            setDuplicates(data);
            setLastRefresh(new Date());
        } catch (error) {
            console.error("Error fetching duplicates:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDuplicates();
    }, []);

    if (duplicates.length === 0 && !isLoading && !showDuplicates) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 mb-8">
            <div className="bg-rose-950/20 border-2 border-rose-500/30 rounded-[3rem] p-8 md:p-10 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <svg className="w-24 h-24 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.45L20.15 19H3.85L12 5.45zM11 16h2v2h-2v-2zm0-7h2v5h-2V9z" /></svg>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 rounded-full text-[10px] font-black uppercase tracking-widest text-white mb-4 shadow-lg shadow-rose-500/20">
                            ALERTA DE SEGURIDAD
                        </div>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-rose-100">Referencias Duplicadas</h2>
                        <p className="text-rose-300/60 text-sm font-bold mt-1">Se han detectado múltiples pagos con el mismo número de comprobante.</p>
                    </div>

                    <div className="flex gap-4">
                        <Button
                            onClick={fetchDuplicates}
                            disabled={isLoading}
                            variant="blue"
                            className="rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-rose-600 hover:bg-rose-500 shadow-xl"
                        >
                            {isLoading ? 'Analizando...' : 'Actualizar'}
                        </Button>
                        <Button
                            onClick={() => setShowDuplicates(!showDuplicates)}
                            variant="blue"
                            className="rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-rose-500 hover:bg-rose-400 shadow-xl shadow-rose-500/20"
                        >
                            {showDuplicates ? 'Ocultar Alertas' : `Ver Alertas (${duplicates.length})`}
                        </Button>
                    </div>
                </div>

                {showDuplicates && (
                    <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                            {duplicates.map((dup) => (
                                <div key={dup.reference} className="bg-slate-900/60 border border-rose-500/20 p-6 rounded-[2rem] hover:border-rose-500/50 transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Referencia</p>
                                            <p className="text-2xl font-black text-white tracking-widest group-hover:text-rose-400 transition-colors uppercase">{dup.reference}</p>
                                        </div>
                                        <div className="bg-rose-500 text-white px-3 py-1 rounded-xl text-[10px] font-black">
                                            {dup.occurrence_count} USOS
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Último Usuario</p>
                                            <p className="text-xs text-rose-100 font-bold uppercase truncate">{dup.latest_user}</p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Campañas Afectadas</p>
                                            <div className="flex flex-wrap gap-2">
                                                {dup.raffle_titles.map(title => (
                                                    <span key={title} className="text-[8px] bg-white/5 px-2 py-1 rounded-md text-slate-400 font-black uppercase tracking-tighter truncate max-w-[120px]">{title}</span>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => onSearchRef(dup.reference)}
                                            className="w-full mt-2 py-3 bg-white/5 hover:bg-rose-500 text-slate-400 hover:text-white rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/5 hover:border-rose-500 transition-all"
                                        >
                                            Investigar Duplicados
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 text-center">
                            <p className="text-[10px] font-bold text-rose-300/30 uppercase tracking-[0.2em]">Último análisis: {lastRefresh.toLocaleTimeString()}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDuplicateRefs;
