-- 🛰️ DISPARADOR AUTOMÁTICO DE CORREOS 🛰️

-- 1. Habilitar extensión net.http si no está (para disparar el webhook)
-- create extension if not exists "pg_net"; 

-- 2. Crear el Webhook mediante un Trigger de Base de Datos
-- Nota: Es más seguro hacerlo por la UI de Supabase (Database -> Webhooks), 
-- pero aquí dejo la estructura por si prefieres SQL.

/*
  CONFIGURACIÓN RECOMENDADA EN PANEL SUPABASE:
  - Name: send-tickets-webhook
  - Table: purchase_requests
  - Events: UPDATE
  - Filter: status is 'approved'
  - Action: Edge Function
  - Edge Function: send-tickets
*/

-- TRIGGER SQL (Alternativa si no usas el panel de Webhooks)
CREATE OR REPLACE FUNCTION public.on_purchase_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Llamamos a la Edge Function de forma asíncrona
    PERFORM net.http_post(
      url := 'https://' || (SELECT value FROM settings WHERE key = 'supabase_project_ref') || '.supabase.co/functions/v1/send-tickets',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM settings WHERE key = 'supabase_anon_key')
      ),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Preferimos guiar al usuario a activar el Webhook de la UI de Supabase para mayor simplicidad.
