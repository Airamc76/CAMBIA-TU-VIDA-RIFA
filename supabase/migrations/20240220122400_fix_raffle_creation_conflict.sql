-- 🎟️ FIX: RAFFLE CREATION CONFLICT 🎟️
-- Resolve 409 Conflict error when creating new raffles.
-- This makes the generate_raffle_numbers trigger idempotent.

CREATE OR REPLACE FUNCTION public.generate_raffle_numbers()
RETURNS trigger AS $$
BEGIN
  -- Use ON CONFLICT DO NOTHING to avoid collision with save_raffle RPC
  -- which also tries to generate tickets at the same time.
  INSERT INTO public.raffle_numbers (raffle_id, number, status)
  SELECT new.id, generate_series(1, new.total_tickets), 'available'
  ON CONFLICT (raffle_id, number) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql;
