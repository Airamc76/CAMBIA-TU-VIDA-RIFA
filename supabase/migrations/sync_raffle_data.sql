-- 🔄 SINCRONIZACIÓN DE DATOS DE RIFAS 🔄
-- Ejecuta esto una vez para poner al día los contadores de lo que ya se vendió.

do $$
declare
  r record;
begin
  for r in select id, total_tickets from public.raffles loop
    
    -- 1. Contar tickets realmente vendidos ('sold')
    update public.raffles
    set sold_tickets = (
      select count(*) 
      from public.raffle_numbers 
      where raffle_id = r.id and status = 'sold'
    )
    where id = r.id;

    -- 2. Actualizar estado si ya no quedan tickets disponibles
    -- (Usamos la misma lógica que el RPC: si no hay 'available', marcar AGOTADA)
    if (select count(*) from public.raffle_numbers where raffle_id = r.id and status = 'available') = 0 then
      update public.raffles set status = 'sold_out' where id = r.id;
    end if;

  end loop;
end;
$$;
