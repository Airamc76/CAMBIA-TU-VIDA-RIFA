
-- 🗑️ RPC: Eliminar Compra y Liberar Tickets 🗑️
-- Esta función permite a los administradores borrar una solicitud y liberar los números asociados.

create or replace function public.delete_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
declare
  v_raffle_id uuid;
  v_user_role text;
begin
  -- 1. Verificar permisos (admin only via get_my_role)
  v_user_role := public.get_my_role();
  if v_user_role is null then
    raise exception 'Acceso denegado. Se requiere rol de administrador.';
  end if;

  -- 2. Obtener raffle_id antes de borrar
  select raffle_id into v_raffle_id from public.purchase_requests where id = p_request_id;
  
  if v_raffle_id is null then
    return; -- Ya no existe
  end if;

  -- 3. Liberar Números (Status available)
  -- El FK 'purchase_id' en raffle_numbers tiene 'on delete set null',
  -- pero necesitamos forzar el status a 'available'.
  update public.raffle_numbers
  set status = 'available', purchase_id = null
  where purchase_id = p_request_id;

  -- 4. Borrar la solicitud
  delete from public.purchase_requests where id = p_request_id;

  -- 5. Sincronizar conteo de la rifa (sold_tickets y status sold_out)
  perform public.sync_raffle_sold_count(v_raffle_id);
end;
$$;

grant execute on function public.delete_purchase to authenticated, service_role;
