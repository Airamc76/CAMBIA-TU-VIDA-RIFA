
# CambiatuvidaConDavid - Frontend UI

Este proyecto es la interfaz de usuario (UI) para una plataforma de rifas online, desarrollada con **React 18**, **TypeScript**, **Vite** y **Tailwind CSS**.

## Requisitos
- Node.js (v18 o superior)
- npm o yarn

## Instalación
Para instalar todas las dependencias del proyecto, ejecuta:
```bash
npm install
```

## Desarrollo Local
Para iniciar el servidor de desarrollo local con recarga en caliente:
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

## Producción
Para generar el build optimizado para producción:
```bash
npm run build
```
Los archivos generados se encontrarán en la carpeta `dist/`.

Para previsualizar el build localmente:
```bash
npm run preview
```

## Características
- **Dark Mode Nativo**: Estética moderna con colores `slate-950`.
- **Responsive**: Diseño mobile-first adaptado a tablets y laptops.
- **Glassmorphism**: Efectos de desenfoque y bordes sutiles en las cards.
- **Lazy Loading**: Las páginas se cargan bajo demanda para optimizar la velocidad inicial.
- **Admin Panel Mock**: Login simulado (`admin`/`admin`) y vista de gestión de pagos.

## Notas Técnicas
- El proyecto utiliza `HashRouter` para asegurar compatibilidad con entornos de hosting estáticos sin configuración de redirección de rutas.
- Los datos son consumidos desde `src/data/mockRaffles.ts`.
- No hay integración real con backend en esta fase beta (UI Only).
