import React, { Suspense, lazy, createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header, Footer } from './components/Layout';
import FloatingSupport from './components/FloatingSupport';
import { Raffle, AdminRole } from './types';
import { dbService } from './services/dbService';
import { supabase } from './lib/supabase';

export interface PurchaseData {
  id: string;
  user: string;
  dni: string;
  whatsapp: string;
  email: string;
  raffle: string;
  raffleId: string;
  amount: string;
  ref: string;
  date: string;
  ticketsCount: number;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  evidence_url?: string;
  evidence_path?: string;
  assignedNumbers?: number[];
}

interface RaffleContextType {
  raffles: Raffle[];
  purchases: PurchaseData[];
  userRole: AdminRole | null;
  isLoading: boolean;
  dbError: string | null;
  addRaffle: (raffle: Raffle) => Promise<void>;
  deleteRaffle: (id: string) => Promise<void>;
  updateRaffle: (raffle: Raffle) => Promise<void>;
  updatePurchaseStatus: (id: string, status: 'aprobado' | 'rechazado') => Promise<void>;
  refreshData: () => Promise<void>;
  setUserRole: (role: AdminRole | null) => void;
}

const RaffleContext = createContext<RaffleContextType | undefined>(undefined);

export const useRaffles = () => {
  const context = useContext(RaffleContext);
  if (!context) throw new Error('useRaffles debe usarse dentro de RaffleProvider');
  return context;
};

const Home = lazy(() => import('./pages/Home'));
const PurchasePage = lazy(() => import('./pages/Purchase'));
const Consult = lazy(() => import('./pages/Consult'));
const AdminTiforbi = lazy(() => import('./pages/AdminTiforbi'));
const AdminPagos = lazy(() => import('./pages/AdminPagos'));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px] animate-pulse">Cargando Sistema...</p>
  </div>
);

const App: React.FC = () => {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [purchases, setPurchases] = useState<PurchaseData[]>([]);
  const [userRole, setUserRole] = useState<AdminRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const refreshData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const dbRaffles = await dbService.getRaffles();
      setRaffles(dbRaffles || []);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Fix: Use RPC to get role instead of direct table query (avoids 406 error)
        try {
          const role = await dbService.getMyRole();
          if (role) {
            setUserRole(role);
            // Si tiene rol, cargamos los pendientes
            if (['pagos', 'superadmin'].includes(role)) {
              const dbRequests = await dbService.getPendingPurchaseRequests();
              setPurchases(dbRequests as PurchaseData[] || []);
            }
          }
        } catch (err) {
          console.warn("Could not fetch role in refreshData:", err);
        }
      }
    } catch (error: any) {
      console.error("Refresh Error:", error);
      setDbError(error?.message || 'Error cargando datos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const addRaffle = async (newRaffle: Raffle) => {
    const saved = await dbService.saveRaffle(newRaffle);
    setRaffles(prev => [saved, ...prev]);
  };

  const deleteRaffle = async (id: string) => {
    await dbService.deleteRaffle(id);
    setRaffles(prev => prev.filter(r => r.id !== id));
  };

  const updateRaffle = async (updated: Raffle) => {
    const saved = await dbService.saveRaffle(updated);
    setRaffles(prev => prev.map(r => r.id === saved.id ? saved : r));
  };

  const updatePurchaseStatus = async (id: string, status: 'aprobado' | 'rechazado') => {
    const dbStatus = status === 'aprobado' ? 'approved' : 'rejected';
    await dbService.updatePurchaseStatus(id, dbStatus);
    await refreshData();
  };

  return (
    <RaffleContext.Provider value={{
      raffles,
      purchases,
      userRole,
      isLoading,
      dbError,
      addRaffle,
      deleteRaffle,
      updateRaffle,
      updatePurchaseStatus,
      refreshData,
      setUserRole
    }}>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 container mx-auto">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/comprar/:id" element={<PurchasePage />} />
                <Route path="/consultar" element={<Consult />} />
                <Route path="/admintiforbi" element={<AdminTiforbi />} />
                <Route path="/pagos" element={<AdminPagos />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
        <FloatingSupport />
      </Router>
    </RaffleContext.Provider>
  );
};

export default App;