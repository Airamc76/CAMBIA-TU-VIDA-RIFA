import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Modal, Button } from './UI';

const openInstagram = (e: React.MouseEvent) => {
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isAndroid) {
    e.preventDefault();
    const username = 'cambiatuvidacondavid';
    // Force Instagram App using Intent with https scheme and specific package
    // This tells Android: "Open https://instagram.com/_u/... specifically with com.instagram.android"
    const url = `intent://www.instagram.com/_u/${username}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=https://www.instagram.com/${username}/;end`;
    window.location.href = url;
  }
  // For iOS/Desktop, let the link handle it naturally (target="_blank")
};

export const Header: React.FC = () => {
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Consultar', path: '/consultar' },
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

          <div className="flex items-center gap-3">
            {/* Social Media Buttons (Desktop only) */}
            <div className="hidden md:flex items-center gap-3">
              <a
                href="https://www.instagram.com/cambiatuvidacondavid/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center text-white hover:scale-110 transition-transform shadow-lg"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </a>
              <a
                href="https://wa.me/5804140170156"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white hover:scale-110 transition-transform shadow-lg"
                aria-label="WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
              </a>
            </div>

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

            {/* Social Media Links for Mobile */}
            <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
              <a
                href="https://www.instagram.com/cambiatuvidacondavid/"
                onClick={openInstagram}
                className="flex-1 flex items-center justify-center gap-3 p-4 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                Instagram
              </a>
              <a
                href="https://wa.me/5804140170156"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-3 p-4 bg-green-500 text-white rounded-2xl font-black text-sm shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                WhatsApp
              </a>
            </div>
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

            <div className="flex items-center justify-center md:hidden gap-4 pt-2">
              <a
                href="https://www.instagram.com/cambiatuvidacondavid/"
                onClick={openInstagram}
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                aria-label="Instagram"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </a>
              <a
                href="https://wa.me/5804140170156"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                aria-label="WhatsApp"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
              </a>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-6 md:gap-10 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
            <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
            <Link to="/consultar" className="hover:text-blue-600 transition-colors">Tickets</Link>
          </div>

          <div className="flex flex-col items-center md:items-end gap-3">
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
              &copy; {new Date().getFullYear()} CambiatuvidaConDavid Digital
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-blue-500 tracking-[0.4em] uppercase">
                DESIGN BY <a href="https://tiforbi.com/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 transition-colors underline decoration-blue-200 underline-offset-4">TIFORBI</a>
              </span>
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
            </div>
          </div>
        </div>

        {/* Lottery Authority Logos & CONALOT Certification */}
        <div className="mt-12 pt-8 border-t border-blue-50">
          <div className="flex flex-col items-center gap-6">
            {/* Lottery Logos */}
            <div className="flex items-center justify-center gap-8 flex-wrap">
              <div className="text-center">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Avalado por:</div>
                <div className="flex items-center gap-6">
                  <div className="bg-white p-2 rounded-xl shadow-md border border-slate-100">
                    <img src="/loteria_tachira.jpg" alt="Lotería del Táchira" className="h-16 w-auto object-contain" />
                  </div>
                  <div className="bg-white p-2 rounded-xl shadow-md border border-slate-100">
                    <img src="/supergana.jpg" alt="Super Gana" className="h-16 w-auto object-contain" />
                  </div>
                </div>
              </div>
            </div>

            {/* CONALOT Certification */}
            <div className="bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-black text-blue-900 uppercase tracking-wide text-center">
                🏆 Sorteo avalado por la CONALOT bajo el número de RUNLOT: <span className="text-blue-600">CNL-ORF-2026-000746</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};