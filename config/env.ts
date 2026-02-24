import { z } from 'zod';

const envSchema = z.object({
    VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL debe ser una URL válida"),
    VITE_SUPABASE_ANON_KEY: z.string().min(1, "VITE_SUPABASE_ANON_KEY requerida"),
    VITE_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

// Validación en tiempo de ejecución (Fail-fast)
const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
    console.error("❌ ERROR CRÍTICO: Variables de entorno inválidas o faltantes.");
    console.error(parsedEnv.error.format());
    throw new Error("Configuración de entorno inválida. Revisa los logs.");
}

export const ENV = parsedEnv.data;
