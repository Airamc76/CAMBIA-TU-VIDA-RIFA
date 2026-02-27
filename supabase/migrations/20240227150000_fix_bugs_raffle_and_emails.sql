-- 🎟️ FIX: RAFFLE DELETION & REJECTION EMAILS 🎟️
-- Este script permite borrar rifas permanentemente y asegura que los correos de rechazo
-- se disparen automáticamente y sin demoras innecesarias.

-- 1. Actualizar restricción de estados en la tabla 'raffles'
ALTER TABLE public.raffles 
DROP CONSTRAINT IF EXISTS raffles_status_check;

ALTER TABLE public.raffles 
ADD CONSTRAINT raffles_status_check 
CHECK (status IN ('active', 'paused', 'closed', 'drawn', 'sold_out', 'deleted'));

-- 2. Asegurar que el Trigger dispare tanto para correos de APROBACIÓN como de RECHAZO
CREATE OR REPLACE FUNCTION public.on_purchase_approved()
RETURNS TRIGGER AS $$
BEGIN
  -- Disparamos para ambos estados y solo cuando el estado realmente cambia
  IF (NEW.status IN ('approved', 'rejected')) AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
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
