
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'blue';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = 'px-6 py-2.5 rounded-xl font-bold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2';
  const variants = {
    primary: 'bg-[#E32929] hover:bg-red-700 text-white shadow-lg shadow-red-600/20',
    secondary: 'bg-[#0066FF] hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10',
    blue: 'bg-[#0066FF] hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20',
    danger: 'bg-rose-100 text-rose-600 hover:bg-rose-200 border border-rose-200',
    ghost: 'bg-transparent hover:bg-blue-50 text-blue-600',
    success: 'bg-[#4ADE80] hover:bg-green-500 text-white shadow-lg shadow-green-600/20'
  };
  
  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-black text-slate-700 tracking-tight">{label}</label>}
      <input 
        className={`bg-white border ${error ? 'border-red-500' : 'border-blue-100'} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder:text-slate-300 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  );
};

export const BadgeStatus: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    ACTIVA: 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm',
    PAUSADA: 'bg-amber-50 text-amber-700 border-amber-200',
    AGOTADA: 'bg-red-50 text-red-700 border-red-200',
    CERRADA: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-[0.15em] ${styles[status.toUpperCase()] || styles.CERRADA}`}>
      {status}
    </span>
  );
};

export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  // Función para determinar el color según el porcentaje (Lógica semáforo)
  const getProgressStyles = (p: number) => {
    if (p >= 70) return { bar: 'bg-[#4ADE80]', text: 'text-green-600', label: 'Excelente' };
    if (p >= 40) return { bar: 'bg-[#FACC15]', text: 'text-yellow-600', label: 'Disponible' };
    if (p >= 15) return { bar: 'bg-[#FB923C]', text: 'text-orange-600', label: 'Pocos tickets' };
    if (p > 0) return { bar: 'bg-[#E32929]', text: 'text-red-600', label: '¡Últimos!' };
    return { bar: 'bg-slate-200', text: 'text-slate-400', label: 'Agotado' };
  };

  const styles = getProgressStyles(progress);

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] mb-2 font-black uppercase tracking-widest">
        <span className="text-slate-400">Tickets Disponibles</span>
        <span className={`${styles.text} transition-colors duration-500`}>{progress}%</span>
      </div>
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
        <div 
          className={`h-full ${styles.bar} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const Modal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-900/10 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-blue-100 animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-8 border-b border-blue-50">
          <h2 className="text-2xl font-black text-blue-900 tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-blue-50 rounded-full transition-colors text-blue-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-8 overflow-y-auto flex-1 text-slate-600 leading-relaxed font-medium">
          {children}
        </div>
        <div className="p-8 border-t border-blue-50 flex justify-end">
          <Button onClick={onClose} variant="blue">Entendido</Button>
        </div>
      </div>
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  variant?: 'primary' | 'danger' | 'blue';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', variant = 'blue' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-900/10 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-blue-100 rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-10 text-center space-y-6">
          <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center ${variant === 'danger' ? 'bg-red-50 text-red-600 shadow-red-100' : 'bg-blue-50 text-blue-600 shadow-blue-100'} shadow-xl`}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-black text-blue-900 tracking-tight">{title}</h3>
            <p className="text-sm text-slate-500 font-bold leading-relaxed">{message}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Button variant="ghost" onClick={onClose} fullWidth className="text-slate-400 font-black">Cerrar</Button>
            <Button variant={variant} onClick={onConfirm} fullWidth className="font-black">{confirmText}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
