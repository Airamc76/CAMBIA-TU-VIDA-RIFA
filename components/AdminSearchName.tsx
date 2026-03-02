
import React, { useState } from 'react';
import { Button, Modal } from './UI';
import { dbService } from '../services/dbService';

const AdminSearchName: React.FC = () => {
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'name' | 'reference'>('name');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        setHasSearched(true);
        try {
            const data = await dbService.searchPurchases(query, searchType);
            setResults(data);
        } catch (error) {
            console.error("Error searching:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;

        setIsDeleting(true);
        try {
            await dbService.deletePurchase(deletingId);
            // Refresh results
            await handleSearch();
            setDeletingId(null);
        } catch (error) {
            console.error("Error deleting purchase:", error);
            alert("Error al eliminar la compra. Verifica los permisos.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 mb-12">
            <div className="bg-slate-900 p-10 md:p-14 rounded-[4rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-colors duration-700"></div>

                <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="space-y-4 max-w-sm text-white">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            Buscador Maestro
                        </div>
                        <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Localizar Usuarios</h2>
                        <p className="text-slate-400 text-sm font-bold leading-relaxed">Busca por nombre o referencia para encontrar tickets y pagos duplicados.</p>
                    </div>

                    <Button
                        onClick={() => setShowSearch(!showSearch)}
                        variant="blue"
                        className="rounded-3xl px-8 py-4 font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-3"
                    >
                        {showSearch ? (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                                Cerrar Herramienta
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                Abrir Buscador
                            </>
                        )}
                    </Button>
                </div>

                {showSearch && (
                    <div className="relative mt-12 pt-12 border-t border-white/10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-6 items-end">
                            <div className="w-full lg:w-48 space-y-3">
                                <label className="text-[10px] font-black text-blue-200 uppercase tracking-widest ml-4">Tipo de Búsqueda</label>
                                <select
                                    className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-6 py-5 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                    value={searchType}
                                    onChange={(e) => setSearchType(e.target.value as any)}
                                >
                                    <option value="name" className="bg-slate-900">Por Nombre</option>
                                    <option value="reference" className="bg-slate-900">Por Referencia</option>
                                </select>
                            </div>

                            <div className="flex-1 w-full space-y-3">
                                <label className="text-[10px] font-black text-blue-200 uppercase tracking-widest ml-4">
                                    {searchType === 'name' ? 'Nombre del Cliente' : 'Número de Referencia'}
                                </label>
                                <input
                                    type="text"
                                    placeholder={searchType === 'name' ? "Ej: Juan Perez" : "Ej: 0258"}
                                    className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-8 py-5 text-2xl font-black text-blue-100 placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-inner"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="py-6 px-12 text-xl font-black rounded-3xl shadow-xl hover:scale-105 transition-transform w-full lg:w-auto"
                                variant="blue"
                                disabled={isSearching || !query.trim()}
                            >
                                {isSearching ? 'Buscando...' : 'Buscar'}
                            </Button>
                        </form>

                        {hasSearched && (
                            <div className="mt-12 space-y-6">
                                {results.length === 0 ? (
                                    <div className="text-center py-20 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
                                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No se encontraron resultados para "{query}"</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-6">
                                            <div className="flex items-center gap-3">
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Coincidencias Encontradas ({results.length})</p>
                                                {searchType === 'reference' && results.length > 1 && (
                                                    <span className="bg-rose-500/20 text-rose-400 text-[9px] font-black px-3 py-1 rounded-full border border-rose-500/30 animate-pulse">
                                                        ⚠️ POSIBLE REFERENCIA DUPLICADA
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {results.map((res) => (
                                                <div key={res.id} className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2.5rem] hover:bg-white/10 transition-colors group/item relative overflow-hidden">

                                                    {/* Botón de Borrar (Liberar) flotante */}
                                                    <button
                                                        onClick={() => setDeletingId(res.id)}
                                                        className="absolute top-6 right-6 p-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl transition-all border border-rose-500/20 z-10"
                                                        title="Liberar Tickets (Borrar Compra)"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>

                                                    <div className="flex justify-between items-start mb-6 pr-12">
                                                        <div className="space-y-1">
                                                            <h4 className="text-white font-black text-2xl italic uppercase tracking-tighter leading-tight">{res.user}</h4>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ID: <span className="text-white">{res.dni}</span></p>
                                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">TEL: <span className="text-white">{res.whatsapp}</span></p>
                                                            </div>
                                                        </div>
                                                        <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.status === 'aprobado' ? 'bg-green-500/20 text-green-400' :
                                                                res.status === 'rechazado' ? 'bg-rose-500/20 text-rose-400' :
                                                                    'bg-orange-500/20 text-orange-400'
                                                            }`}>
                                                            {res.status}
                                                        </div>
                                                    </div>

                                                    <div className="bg-white/5 rounded-3xl p-5 mb-6 border border-white/5">
                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div>
                                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Campaña / Rifa</p>
                                                                <p className="text-xs text-blue-200 font-black uppercase tracking-tight leading-tight">{res.raffle}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Monto Pagado</p>
                                                                <p className="text-lg font-black text-white">{res.amount} Bs.</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                                                            <div>
                                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Referencia</p>
                                                                <p className={`text-xs font-black tracking-widest uppercase ${searchType === 'reference' ? 'text-yellow-400' : 'text-blue-400'}`}>{res.ref || 'S/N'}</p>
                                                            </div>
                                                            {res.evidence_url && (
                                                                <button
                                                                    onClick={() => setViewingEvidence(res.evidence_url)}
                                                                    className="px-4 py-2 bg-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg hover:scale-105 transition-transform"
                                                                >
                                                                    Ver Comprobante
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Números Asignados ({res.ticketsCount})</p>
                                                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{res.date}</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {res.assignedNumbers && res.assignedNumbers.map((num: number) => (
                                                                <span key={num} className="bg-blue-600/20 text-blue-400 text-[10px] font-black px-3 py-1 rounded-lg border border-blue-500/20">
                                                                    #{num}
                                                                </span>
                                                            ))}
                                                            {(!res.assignedNumbers || res.assignedNumbers.length === 0) && (
                                                                <span className="text-[9px] text-slate-600 font-black uppercase italic">Sin números asignados</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Comprobante */}
            <Modal
                isOpen={!!viewingEvidence}
                onClose={() => setViewingEvidence(null)}
                title="Comprobante de Pago"
            >
                <div className="flex items-center justify-center p-4 bg-slate-50 rounded-3xl">
                    <img
                        src={viewingEvidence!}
                        className="max-w-full h-auto rounded-xl shadow-2xl"
                        alt="Comprobante"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGExYjIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIyIiB5PSIzIiB3aWR0aD0iMjAiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWdvbiBwb2ludHM9IjIxIDE1IDE2IDEwIDUgMjEgMjEgMjEiPjwvcG9seWdvbj48L3N2Zz4=';
                        }}
                    />
                </div>
            </Modal>

            {/* Modal de Confirmación de Borrado */}
            <Modal
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                title="¿Liberar Tickets?"
            >
                <div className="space-y-6">
                    <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 italic text-slate-600 text-sm">
                        Esta acción eliminará permanentemente la compra y liberará los números para que otras personas puedan comprarlos.
                        <span className="block mt-2 font-black uppercase text-rose-500 text-[10px] tracking-widest">⚠️ Esta acción no se puede deshacer.</span>
                    </div>
                    <div className="flex gap-4">
                        <Button
                            onClick={() => setDeletingId(null)}
                            fullWidth
                            className="bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-2xl py-4"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleDelete}
                            variant="danger"
                            fullWidth
                            disabled={isDeleting}
                            className="rounded-2xl py-4 font-black uppercase tracking-widest shadow-xl shadow-rose-500/20"
                        >
                            {isDeleting ? 'Liberando...' : 'Liberar Tickets'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AdminSearchName;
