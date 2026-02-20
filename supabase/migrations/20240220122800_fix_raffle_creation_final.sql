-- 🎟️ FINAL FIX: RAFFLE CREATION & SYNC 🎟️
-- Unifies ranges (0..N-1), adds idempotency (ON CONFLICT), and ensures consistency.

-- 1. Unify Trigger Function
CREATE OR REPLACE FUNCTION public.generate_raffle_numbers()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.raffle_numbers (raffle_id, number, status)
  SELECT new.id, num, 'available'
  FROM generate_series(0, new.total_tickets - 1) AS t(num)
  ON CONFLICT (raffle_id, number) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 2. Update save_raffle RPC
CREATE OR REPLACE FUNCTION public.save_raffle(p_raffle jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public AS $$
DECLARE
  v_user_role text;
  v_result jsonb;
  v_raffle_id uuid;
  v_new_total int;
  v_sold_count int;
  v_status text;
BEGIN
  -- 🛡️ Security Check
  SELECT role INTO v_user_role FROM public.admins WHERE user_id = auth.uid();
  IF v_user_role IS NULL OR v_user_role != 'superadmin' THEN
    RAISE EXCEPTION 'Acceso denegado. Se requiere rol superadmin.';
  END IF;

  v_raffle_id := COALESCE((p_raffle->>'id')::uuid, gen_random_uuid());
  v_new_total := (p_raffle->>'total_tickets')::integer;
  v_status := COALESCE(p_raffle->>'status', 'active');

  -- 📊 Current sold count
  SELECT COUNT(*) INTO v_sold_count FROM public.raffle_numbers 
  WHERE raffle_id = v_raffle_id AND status = 'sold';

  -- Adjust total if trying to lower it below already sold tickets
  IF v_new_total < v_sold_count THEN v_new_total := v_sold_count; END IF;

  -- 🔄 SYNC RAFFLE
  INSERT INTO public.raffles (
    id, title, description, ticket_price, total_tickets, 
    status, draw_date, cover_url, prizes, currency, sold_tickets
  )
  VALUES (
    v_raffle_id, p_raffle->>'title', p_raffle->>'description',
    (p_raffle->>'ticket_price')::numeric, v_new_total, v_status,
    (p_raffle->>'draw_date')::timestamp with time zone, p_raffle->>'cover_url',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(p_raffle->'prizes') x), '{}'),
    COALESCE(p_raffle->>'currency', 'Bs'), v_sold_count
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description,
    ticket_price = EXCLUDED.ticket_price, total_tickets = EXCLUDED.total_tickets,
    status = EXCLUDED.status, draw_date = EXCLUDED.draw_date,
    cover_url = EXCLUDED.cover_url, prizes = EXCLUDED.prizes,
    currency = EXCLUDED.currency, sold_tickets = v_sold_count;

  -- 🔄 SYNC NUMBERS (Range 0 to total_tickets - 1)
  -- 1. Delete extra numbers that are not sold
  DELETE FROM public.raffle_numbers 
  WHERE raffle_id = v_raffle_id AND number >= v_new_total AND status != 'sold';

  -- 2. Insert missing numbers (Idempotent)
  INSERT INTO public.raffle_numbers (raffle_id, number, status)
  SELECT v_raffle_id, n, 'available'
  FROM generate_series(0, v_new_total - 1) n
  ON CONFLICT (raffle_id, number) DO NOTHING;

  -- ⚡ Status logic (sold_out if no numbers available)
  IF NOT EXISTS (SELECT 1 FROM public.raffle_numbers WHERE raffle_id = v_raffle_id AND status = 'available') THEN
      UPDATE public.raffles SET status = 'sold_out' WHERE id = v_raffle_id;
  END IF;

  SELECT TO_JSONB(r.*) INTO v_result FROM public.raffles r WHERE id = v_raffle_id;
  RETURN v_result;
END;
$$;
