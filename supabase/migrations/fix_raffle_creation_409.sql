
-- 🎟️ FIX: 409 CONFLICT & TICKET SYNC 🎟️
-- Unifica la lógica de generación aleatoria (5 dígitos) y añade ON CONFLICT para evitar errores de carrera.

-- 1. Actualizar Función de Trigger (Idempotente)
CREATE OR REPLACE FUNCTION public.generate_raffle_numbers()
RETURNS trigger AS $$
BEGIN
  -- Validar capacidad para 5 dígitos
  IF new.total_tickets > 100000 THEN
    RAISE EXCEPTION 'Para 5 dígitos, el máximo de tickets es 100,000.';
  END IF;

  -- Insertar de forma aleatoria desde el universo 0-99999
  INSERT INTO public.raffle_numbers (raffle_id, number, status)
  SELECT new.id, num, 'available'
  FROM generate_series(0, 99999) AS t(num)
  ORDER BY random()
  LIMIT new.total_tickets
  ON CONFLICT (raffle_id, number) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 2. Actualizar RPC save_raffle (Robusto y Coherente)
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
  v_draw_date timestamptz;
BEGIN
  -- 🛡️ Seguridad
  SELECT role INTO v_user_role FROM public.admins WHERE user_id = auth.uid();
  IF v_user_role IS NULL OR v_user_role != 'superadmin' THEN
    RAISE EXCEPTION 'Acceso denegado. Se requiere rol superadmin.';
  END IF;

  -- 📋 Parseo de datos (Safe parsing)
  v_raffle_id := COALESCE(NULLIF(p_raffle->>'id', '')::uuid, gen_random_uuid());
  v_new_total := COALESCE(NULLIF(p_raffle->>'total_tickets', '')::integer, 0);
  v_status := COALESCE(NULLIF(p_raffle->>'status', ''), 'active');
  v_draw_date := NULLIF(p_raffle->>'draw_date', '')::timestamptz;

  -- 📊 Conteo actual de vendidos
  SELECT COUNT(*) INTO v_sold_count FROM public.raffle_numbers 
  WHERE raffle_id = v_raffle_id AND status = 'sold';

  -- Ajustar total si se intenta bajar por debajo de lo ya vendido
  IF v_new_total < v_sold_count THEN v_new_total := v_sold_count; END IF;

  -- 🔄 Upsert de la Rifa
  INSERT INTO public.raffles (
    id, title, description, ticket_price, total_tickets, 
    status, draw_date, cover_url, prizes, currency, sold_tickets
  )
  VALUES (
    v_raffle_id, 
    COALESCE(p_raffle->>'title', 'Sin Título'), 
    p_raffle->>'description',
    COALESCE(NULLIF(p_raffle->>'ticket_price', '')::numeric, 0), 
    v_new_total, 
    v_status,
    v_draw_date, 
    p_raffle->>'cover_url',
    COALESCE((
      SELECT array_agg(x) 
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_raffle->'prizes') = 'array' THEN p_raffle->'prizes' ELSE '[]'::jsonb END) x
    ), '{}'),
    COALESCE(p_raffle->>'currency', 'Bs'), 
    v_sold_count
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, 
    description = EXCLUDED.description,
    ticket_price = EXCLUDED.ticket_price, 
    total_tickets = EXCLUDED.total_tickets,
    status = EXCLUDED.status, 
    draw_date = EXCLUDED.draw_date,
    cover_url = EXCLUDED.cover_url, 
    prizes = EXCLUDED.prizes,
    currency = EXCLUDED.currency, 
    sold_tickets = v_sold_count;

  -- 🔄 SINCRONIZACIÓN DE NÚMEROS (Pestaña "Sorteos" / "Crear")
  -- 1. Eliminar excedentes que no estén vendidos si el total bajó
  DELETE FROM public.raffle_numbers 
  WHERE raffle_id = v_raffle_id AND status = 'available' 
    AND id NOT IN (
      SELECT id FROM public.raffle_numbers 
      WHERE raffle_id = v_raffle_id
      ORDER BY number ASC -- O cualquier criterio de prioridad
      LIMIT v_new_total
    );

  -- 2. Insertar faltantes si el total subió (Lógica 5 dígitos aleatorios)
  -- Intentamos rellenar hasta llegar al total deseado
  IF v_new_total > (SELECT count(*) FROM public.raffle_numbers WHERE raffle_id = v_raffle_id) THEN
    INSERT INTO public.raffle_numbers (raffle_id, number, status)
    SELECT v_raffle_id, n, 'available'
    FROM generate_series(0, 99999) n
    WHERE NOT EXISTS (SELECT 1 FROM public.raffle_numbers WHERE raffle_id = v_raffle_id AND number = n)
    ORDER BY random()
    LIMIT (v_new_total - (SELECT count(*) FROM public.raffle_numbers WHERE raffle_id = v_raffle_id))
    ON CONFLICT (raffle_id, number) DO NOTHING;
  END IF;

  -- ⚡ Lógica de estado automático
  IF (SELECT count(*) FROM public.raffle_numbers WHERE raffle_id = v_raffle_id AND status = 'available') = 0 
     AND EXISTS (SELECT 1 FROM public.raffle_numbers WHERE raffle_id = v_raffle_id) THEN
      UPDATE public.raffles SET status = 'sold_out' WHERE id = v_raffle_id;
  END IF;

  SELECT TO_JSONB(r.*) INTO v_result FROM public.raffles r WHERE id = v_raffle_id;
  RETURN v_result;
END;
$$;
