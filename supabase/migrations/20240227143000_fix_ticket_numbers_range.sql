-- 🎟️ FIX: TICKET RANGE & RE-ASSIGNMENT 🎟️
-- Ajusta el rango de tickets al total de la rifa y reasigna números válidos a compras previas.

-- 1. Asegurar que el Trigger use el rango correcto (0 a total - 1)
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

-- 2. Limpieza de números fuera de rango para rifas existentes
-- Elimina tickets 'available' que estén por encima del total_tickets - 1
DELETE FROM public.raffle_numbers rn
USING public.raffles r
WHERE rn.raffle_id = r.id
  AND rn.status = 'available'
  AND rn.number >= r.total_tickets;

-- 3. Función para reasignar números de manera segura
DO $$
DECLARE
  v_purchase record;
  v_new_numbers int[];
  v_raffle_total int;
  v_needed int;
  v_avail int[];
BEGIN
  -- Iterar sobre compras que tengan números fuera de rango
  -- (Detectamos números > 9999 o simplemente >= total_tickets de su rifa)
  FOR v_purchase IN 
    SELECT pr.id, pr.raffle_id, pr.ticket_qty, pr.assigned_numbers, r.total_tickets
    FROM public.purchase_requests pr
    JOIN public.raffles r ON pr.raffle_id = r.id
    WHERE pr.status = 'approved'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(pr.assigned_numbers) as n 
        WHERE n::int >= r.total_tickets
      )
  LOOP
    v_raffle_total := v_purchase.total_tickets;
    v_needed := v_purchase.ticket_qty;
    
    -- Obtener números disponibles en el rango correcto para esta rifa
    SELECT array_agg(number) INTO v_avail
    FROM (
      SELECT number FROM public.raffle_numbers 
      WHERE raffle_id = v_purchase.raffle_id AND status = 'available'
      ORDER BY random()
      LIMIT v_needed
    ) AS sub;

    -- Si hay suficientes disponibles, reasignar
    IF array_length(v_avail, 1) = v_needed THEN
      -- Marcar los nuevos como vendidos
      UPDATE public.raffle_numbers 
      SET status = 'sold' 
      WHERE raffle_id = v_purchase.raffle_id AND number = ANY(v_avail);
      
      -- Liberar los viejos que estaban marcados como sold (si existían en raffle_numbers)
      UPDATE public.raffle_numbers 
      SET status = 'available'
      WHERE raffle_id = v_purchase.raffle_id 
        AND number = ANY(
          SELECT n::int FROM jsonb_array_elements_text(v_purchase.assigned_numbers) as n
        )
        AND number >= v_raffle_total;

      -- Actualizar la compra con los nuevos números
      UPDATE public.purchase_requests 
      SET assigned_numbers = to_jsonb(v_avail)
      WHERE id = v_purchase.id;
      
      RAISE NOTICE 'Reasignada compra %: % -> %', v_purchase.id, v_purchase.assigned_numbers, v_avail;
    ELSE
      RAISE WARNING 'No hay suficientes números disponibles para reasignar compra %', v_purchase.id;
    END IF;
  END LOOP;
END $$;

-- 4. Sincronizar conteo de vendidos en tabla raffles
UPDATE public.raffles r
SET sold_tickets = (
  SELECT count(*) FROM public.raffle_numbers rn 
  WHERE rn.raffle_id = r.id AND rn.status = 'sold'
);
