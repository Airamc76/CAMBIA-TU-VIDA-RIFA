-- 🎟️ REPARACIÓN DE RIFAS Y ROLES (V2) 🎟️

-- 1. ESTRUCTURA
alter table public.raffles add column if not exists prizes text[] default '{}';
alter table public.raffles add column if not exists currency text default 'Bs';

-- 2. ROLES
update public.admins 
set role = 'superadmin' 
where user_id in (select id from auth.users where email = 'airamcrespo11@gmail.com');

-- 3. RPC PARA GUARDAR RIFAS (Bypassear RLS problemático)
create or replace function public.save_raffle(p_raffle jsonb)
returns jsonb language plpgsql security definer 
set search_path = public
as $$
declare
  v_user_role text;
  v_result jsonb;
begin
  -- 1. Verificación de seguridad
  select role into v_user_role from public.admins where user_id = auth.uid();
  if v_user_role is null or v_user_role != 'superadmin' then
    raise exception 'Acceso denegado. Se requiere rol superadmin.';
  end if;

  -- 2. Upsert
  insert into public.raffles (
    id, title, description, ticket_price, total_tickets, 
    status, draw_date, cover_url, prizes, currency, sold_tickets
  )
  values (
    coalesce((p_raffle->>'id')::uuid, gen_random_uuid()),
    p_raffle->>'title',
    p_raffle->>'description',
    (p_raffle->>'ticket_price')::numeric,
    (p_raffle->>'total_tickets')::integer,
    coalesce(p_raffle->>'status', 'active'),
    (p_raffle->>'draw_date')::timestamp with time zone,
    p_raffle->>'cover_url',
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_raffle->'prizes') x), '{}'),
    coalesce(p_raffle->>'currency', 'Bs'),
    coalesce((p_raffle->>'sold_tickets')::integer, 0)
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    ticket_price = excluded.ticket_price,
    total_tickets = excluded.total_tickets,
    status = excluded.status,
    draw_date = excluded.draw_date,
    cover_url = excluded.cover_url,
    prizes = excluded.prizes,
    currency = excluded.currency
  returning to_jsonb(raffles.*) into v_result;

  return v_result;
end;
$$;

grant execute on function public.save_raffle to authenticated;
