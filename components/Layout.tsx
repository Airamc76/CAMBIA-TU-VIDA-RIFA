import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Modal, Button } from './UI';

export const Header: React.FC = () => {
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Consultar', path: '/consultar' },
    { name: 'Pagos', path: '/adminpagos' },
    { name: 'Admin', path: '/admintiforbi' },
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-blue-50 bg-white/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" onClick={closeMobileMenu}>
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-blue-200 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <img src="/logo_full.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-2xl tracking-tighter text-slate-900">
              Cambiatuvida<span className="text-blue-600">ConDavid</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-[10px] font-black uppercase tracking-widest transition-all hover:text-blue-600 ${location.pathname === link.path ? 'text-blue-600' : 'text-slate-400'
                  }`}
              >
                {link.name}
              </Link>
            ))}
            <button
              onClick={() => setIsTermsOpen(true)}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 border-2 border-blue-50 px-5 py-2 rounded-full transition-all hover:bg-blue-50"
            >
              Términos
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-3 text-blue-600 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full h-[calc(100vh-80px)] bg-white z-50 animate-in slide-in-from-top duration-500 p-6 flex flex-col gap-4 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={closeMobileMenu}
                className={`text-xl font-black p-6 rounded-[2rem] transition-all flex items-center justify-between group ${location.pathname === link.path
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-200'
                  : 'text-slate-800 active:bg-blue-50 border border-blue-50'
                  }`}
              >
                {link.name}
                <svg className="w-6 h-6 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}
            <button
              onClick={() => {
                closeMobileMenu();
                setIsTermsOpen(true);
              }}
              className="text-lg font-black p-6 rounded-[2rem] text-blue-600 bg-blue-50 border border-blue-100 text-left active:bg-blue-100"
            >
              Términos y Condiciones
            </button>
          </div>
        )}
      </header>

      <Modal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        title="Términos y Condiciones"
      >
        <div className="space-y-6 pb-4">
          <p className="text-slate-500 font-bold mb-6 italic">Por favor, lee y acepta nuestros términos para participar.</p>

          <ol className="space-y-6">
            {[
              "Los números disponibles para la compra en cada sorteo se especificarán en la página de detalles correspondientes a cada sorteo.",
              "Debes verificar tu compra antes de confirmarla haciendo clic en \"Comprar\". No realizamos reembolsos por errores cometidos por el usuario.",
              "Los tickets se enviarán en un plazo máximo de 24 horas, debido al alto volumen de pagos por procesar.",
              "Solo pueden participar personas naturales mayores de 18 años con nacionalidad venezolana o extranjeros. Los ganadores en el extranjero deberán designar a una persona de confianza en Venezuela para recibir el premio.",
              "Los premios deben retirarse en persona en la ubicación designada para cada sorteo. Realizamos entregas personales únicamente en la dirección indicada por el ganador del primer premio o premio mayor.",
              "La compra mínima requerida para participar es de tres (03) tickets. Estos se asignarán de manera aleatoria y se enviarán al correo electrónico proporcionados.",
              "Tienes un plazo de 72 horas para reclamar tu premio.",
              "Los ganadores aceptan aparecer en el contenido audiovisual del sorteo, mostrando su presencia en redes sociales y durante la entrega de premios. Esto es OBLIGATORIO."
            ].map((text, idx) => (
              <li key={idx} className="flex gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">
                  {idx + 1}
                </span>
                <p className="text-sm font-medium leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </Modal>
    </>
  );
};

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-blue-50 bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-12">
          <div className="flex flex-col items-center md:items-start gap-5">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md">
                <img src="/logo_full.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-black text-xl tracking-tighter text-slate-900">Cambiatuvida<span className="text-blue-600">ConDavid</span></span>
            </Link>
            <p className="text-slate-400 text-sm max-w-xs text-center md:text-left font-bold leading-relaxed">
              La plataforma definitiva para sorteos seguros, transparentes y emocionantes.
            </p>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-6 md:gap-10 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
            <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
            <Link to="/consultar" className="hover:text-blue-600 transition-colors">Tickets</Link>
            <Link to="/adminpagos" className="hover:text-blue-600 transition-colors">Staff Pagos</Link>
            <Link to="/admintiforbi" className="hover:text-blue-600 transition-colors">Admin Root</Link>
          </div>

          <div className="flex flex-col items-center md:items-end gap-3">
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
              &copy; {new Date().getFullYear()} CambiatuvidaConDavid Digital
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-blue-500 tracking-[0.4em] uppercase">
                SISTEMA POR <a href="https://tiforbi.com/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 transition-colors underline decoration-blue-200 underline-offset-4">TIFORBI</a>
              </span>
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};