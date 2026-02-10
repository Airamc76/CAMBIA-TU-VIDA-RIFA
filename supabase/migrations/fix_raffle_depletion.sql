-- 🎟️ REPARACIÓN DE RIFAS, ROLES Y SINCRONIZACIÓN (V4) 🎟️

-- 1. RPC: GUARDAR RIFAS (Con sincronización y cambio de estado automático)
create or replace function public.save_raffle(p_raffle jsonb)
returns jsonb language plpgsql security definer 
set search_path = public
as $$
declare
  v_user_role text;
  v_result jsonb;
  v_raffle_id uuid;
  v_new_total int;
  v_sold_count int;
  v_status text;
begin
  -- 🛡️ Seguridad
  select role into v_user_role from public.admins where user_id = auth.uid();
  if v_user_role is null or v_user_role != 'superadmin' then
    raise exception 'Acceso denegado. Se requiere rol superadmin.';
  end if;

  v_raffle_id := coalesce((p_raffle->>'id')::uuid, gen_random_uuid());
  v_new_total := (p_raffle->>'total_tickets')::integer;
  v_status := coalesce(p_raffle->>'status', 'active');

  -- 📊 Conteo actual de vendidos
  select count(*) into v_sold_count from public.raffle_numbers 
  where raffle_id = v_raffle_id and status = 'sold';

  -- Ajustar total si se intenta bajar por debajo de lo ya vendido
  if v_new_total < v_sold_count then
    v_new_total := v_sold_count;
  end if;

  -- 🔄 SINCRONIZAR NÚMEROS (Limpiar excedentes antes de guardar)
  delete from public.raffle_numbers 
  where raffle_id = v_raffle_id 
    and number > v_new_total 
    and status != 'sold';

  insert into public.raffle_numbers (raffle_id, number, status)
  select v_raffle_id, n, 'available'
  from generate_series(1, v_new_total) n
  where not exists (
    select 1 from public.raffle_numbers 
    where raffle_id = v_raffle_id and number = n
  );

  -- ⚡ LÓGICA DE ESTADO DINÁMICO
  -- Si no quedan disponibles, forzamos 'sold_out'
  if not exists (select 1 from public.raffle_numbers where raffle_id = v_raffle_id and status = 'available') then
      v_status := 'sold_out';
  end if;

  -- 📝 Upsert Final
  insert into public.raffles (
    id, title, description, ticket_price, total_tickets, 
    status, draw_date, cover_url, prizes, currency, sold_tickets
  )
  values (
    v_raffle_id,
    p_raffle->>'title',
    p_raffle->>'description',
    (p_raffle->>'ticket_price')::numeric,
    v_new_total,
    v_status,
    (p_raffle->>'draw_date')::timestamp with time zone,
    p_raffle->>'cover_url',
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_raffle->'prizes') x), '{}'),
    coalesce(p_raffle->>'currency', 'Bs'),
    v_sold_count
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
    currency = excluded.currency,
    sold_tickets = v_sold_count
  returning to_jsonb(raffles.*) into v_result;

  return v_result;
end;
$$;

-- 2. RPC: APROBAR COMPRA (Garantizar sold_out)
create or replace function public.approve_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
declare
  v_raffle_id uuid;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Acceso denegado.';
  end if;

  select raffle_id into v_raffle_id from public.purchase_requests where id = p_request_id;

  update public.purchase_requests set status = 'approved' where id = p_request_id;
  update public.raffle_numbers set status = 'sold' where purchase_id = p_request_id;
  
  -- Sincronizar conteo y estado
  update public.raffles r
  set 
    sold_tickets = (select count(*) from public.raffle_numbers where raffle_id = v_raffle_id and status = 'sold'),
    status = case 
      when not exists (select 1 from public.raffle_numbers where raffle_id = v_raffle_id and status = 'available') 
      then 'sold_out'::text 
      else r.status 
    end
  where id = v_raffle_id;
end;
$$;
