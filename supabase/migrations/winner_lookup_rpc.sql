-- 🏆 BUSCADOR DE GANADORES POR NÚMERO (FIXED v2) 🏆
-- Fix: usa assigned_numbers (JSONB) como fuente de verdad en lugar de
-- raffle_numbers.status='sold', que puede quedar en 'reserved' para pagos
-- aprobados antes del migration fix_raffle_depletion.sql

create or replace function public.search_ticket_winner(p_raffle_id uuid, p_number int)
returns table (
  full_name text,
  national_id text,
  email text,
  whatsapp text,
  ticket_status text,
  purchase_status text,
  raffle_title text,
  assigned_numbers jsonb
) language plpgsql security definer
as $$
begin
  -- 🛡️ Solo admins pueden buscar ganadores
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Acceso denegado.';
  end if;

  return query
  select
    pr.full_name,
    pr.national_id,
    pr.email,
    pr.whatsapp,
    -- Estado real del número si existe en raffle_numbers, sino 'assigned'
    coalesce(rn.status::text, 'assigned') as ticket_status,
    pr.status::text as purchase_status,
    r.title as raffle_title,
    pr.assigned_numbers
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  left join public.raffle_numbers rn
    on rn.purchase_id = pr.id
    and rn.number = p_number
    and rn.raffle_id = p_raffle_id
  where pr.raffle_id = p_raffle_id
    and pr.status = 'approved'
    -- Busca en el array JSON asignado (fuente de verdad desde create_purchase_request)
    and pr.assigned_numbers @> jsonb_build_array(p_number)
  limit 1;
end;
$$;

grant execute on function public.search_ticket_winner to authenticated;
