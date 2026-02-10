
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
- **Full-Stack Integration**: Conectado a **Supabase** para base de datos, autenticación (MFA) y almacenamiento.
- **Raffle Engine**: Lógica de asignación de tickets dinámica y segura.
- **Notificaciones**: Envío automático de tickets vía **Resend**.

## Producción e Implementación
Consulta el archivo [deployment_guide.md](file:///C:/Users/Airam/.gemini/antigravity/brain/9dc6449b-65e4-4896-9a98-6d9a65c99e82/deployment_guide.md) para ver los pasos detallados para lanzar la beta fuera de localhost.
