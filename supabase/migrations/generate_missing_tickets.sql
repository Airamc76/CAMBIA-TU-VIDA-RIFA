-- 🎟️ FIX: GENERAR TICKETS FALTANTES
-- Este script revisa todas las rifas y, si alguna no tiene sus 'raffle_numbers' generados, los crea.
-- Esto soluciona el error "No hay suficientes tickets disponibles" en rifas existentes.

do $$
declare
  r record;
  v_count int;
begin
  for r in select * from public.raffles where status != 'deleted' loop
    
    -- Verificar cuántos tickets existen para esta rifa
    select count(*) into v_count from public.raffle_numbers where raffle_id = r.id;
    
    -- Si no hay tickets (o hay menos de los debidos, aunque aquí asumimos 0 = faltan todos), generarlos
    if v_count = 0 then
      raise notice 'Generando % tickets para la rifa: %', r.total_tickets, r.title;
      
      insert into public.raffle_numbers (raffle_id, number, status)
      select r.id, generate_series(0, r.total_tickets - 1), 'available'; 
      -- NOTA: Usamos 0 a total-1 o 1 a total según tu preferencia. 
      -- Si tu rifa de 100 tickets es del 00 al 99, usa 0..total-1.
      -- Si es del 01 al 100, usa 1..total.
      -- Asumiré 0..total-1 para cubrir el "00" que es común, o 1..total si prefieres.
      -- AJUSTE: Basado en implementaciones previas, usaré 0..N-1 si es común, o mejor 1..N.
      -- Voy a usar 000..999 patrón común en rifas de 3 cifras.
      -- Si prefieres 1..1000, cambia abajo.
      
    elsif v_count < r.total_tickets then
        raise notice '⚠️ La rifa % tiene % tickets pero debería tener %. (No se realizó acción automática para evitar duplicados)', r.title, v_count, r.total_tickets;
    else
        raise notice '✅ La rifa % tiene sus % tickets completos.', r.title, v_count;
    end if;
  end loop;
end;
$$;

-- Bloque separado para asegurarse de la generación correcta (versión segura 0..N-1)
-- Si prefieres que el ticket #1 sea el 0, descomenta la lógica de arriba y usa esta:
insert into public.raffle_numbers (raffle_id, number, status)
select r.id, s.n, 'available'
from public.raffles r
cross join generate_series(0, r.total_tickets - 1) as s(n)
where r.status != 'deleted'
and not exists (select 1 from public.raffle_numbers rn where rn.raffle_id = r.id);
