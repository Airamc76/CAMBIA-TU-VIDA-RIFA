-- 🎟️ FIX: TICKET RELEASE VISUAL INCONSISTENCY 🎟️
-- Clears assigned_numbers when a purchase is rejected.

CREATE OR REPLACE FUNCTION public.reject_purchase(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo admins (usando get_my_role para seguridad)
  IF public.get_my_role() IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado.';
  END IF;

  -- 1. Actualizar Request: Marcar como rechazado y LIMPIAR números asignados
  UPDATE public.purchase_requests
  SET 
    status = 'rejected',
    assigned_numbers = NULL -- Liberación visual
  WHERE id = p_request_id;

  -- 2. Liberar Números en la tabla maestra (Liberación funcional)
  UPDATE public.raffle_numbers
  SET 
    status = 'available',
    purchase_id = NULL,
    updated_at = NOW()
  WHERE purchase_id = p_request_id;
END;
$$;
