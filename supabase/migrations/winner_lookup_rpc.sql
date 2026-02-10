-- 🏆 BUSCADOR DE GANADORES POR NÚMERO 🏆

create or replace function public.search_ticket_winner(p_raffle_id uuid, p_number int)
returns table (
  full_name text,
  national_id text,
  email text,
  whatsapp text,
  ticket_status text,
  purchase_status text,
  raffle_title text
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
    rn.status::text as ticket_status,
    pr.status::text as purchase_status,
    r.title as raffle_title
  from public.raffle_numbers rn
  join public.purchase_requests pr on rn.purchase_id = pr.id
  join public.raffles r on rn.raffle_id = r.id
  where rn.raffle_id = p_raffle_id 
    and rn.number = p_number
    and rn.status = 'sold'; -- Solo buscamos ganadores reales
end;
$$;

grant execute on function public.search_ticket_winner to authenticated;
