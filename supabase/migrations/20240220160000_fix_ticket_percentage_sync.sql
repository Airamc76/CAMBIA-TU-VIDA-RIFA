-- 🎟️ SYNCRONIZACIÓN DE PORCENTAJE DE TICKETS (TIEMPO REAL) 🎟️
-- Este script asegura que 'sold_tickets' en la tabla 'raffles' cuente tanto 'reserved' como 'sold'.

-- 1. Función Única para Sincronizar (Evitar duplicación de lógica)
create or replace function public.sync_raffle_sold_count(p_raffle_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.raffles r
  set 
    sold_tickets = (
      select count(*) 
      from public.raffle_numbers 
      where raffle_id = p_raffle_id and status in ('reserved', 'sold')
    ),
    status = case 
      when not exists (
        select 1 from public.raffle_numbers 
        where raffle_id = p_raffle_id and status = 'available'
      ) then 'sold_out'::text 
      else r.status 
    end
  where id = p_raffle_id;
end;
$$;

-- 2. Actualizar RPC: create_purchase_request (Sincronizar al reservar)
create or replace function public.create_purchase_request(
  p_raffle_id uuid,
  p_full_name text,
  p_national_id text,
  p_email text,
  p_whatsapp text,
  p_ticket_qty int,
  p_amount numeric,
  p_payment_method text,
  p_reference text,
  p_receipt_path text
) returns uuid language plpgsql security definer as $$
declare
  v_request_id uuid;
  v_numbers jsonb;
  v_raffle_status text;
begin
  -- Validar estado rifa
  select status into v_raffle_status from public.raffles where id = p_raffle_id;
  if v_raffle_status != 'active' then
    raise exception 'La rifa no está activa (%s).', v_raffle_status;
  end if;

  -- 1. Verificar disponibilidad
  if (select count(*) from public.raffle_numbers where raffle_id = p_raffle_id and status = 'available') < p_ticket_qty then
    raise exception 'No hay suficientes tickets disponibles.';
  end if;

  -- 2. Insertar Request (Status pending)
  insert into public.purchase_requests (
    raffle_id, full_name, national_id, email, whatsapp, 
    ticket_qty, amount, payment_method, reference, receipt_path, 
    status, user_id
  ) values (
    p_raffle_id, p_full_name, p_national_id, p_email, p_whatsapp, 
    p_ticket_qty, p_amount, p_payment_method, p_reference, p_receipt_path, 
    'pending', auth.uid()
  ) returning id into v_request_id;

  -- 3. Reservar Números (Status reserved)
  with selected as (
    select id, number
    from public.raffle_numbers
    where raffle_id = p_raffle_id and status = 'available'
    order by random()
    limit p_ticket_qty
    for update skip locked
  )
  update public.raffle_numbers
  set status = 'reserved', purchase_id = v_request_id, updated_at = now()
  from selected
  where public.raffle_numbers.id = selected.id;

  -- Verificar éxito de reserva
  if (select count(*) from public.raffle_numbers where purchase_id = v_request_id) < p_ticket_qty then
    raise exception 'tickets_sold_out';
  end if;

  -- 4. GUARDAR assigned_numbers (JSONB)
  select jsonb_agg(number order by number) into v_numbers
  from public.raffle_numbers
  where purchase_id = v_request_id;

  update public.purchase_requests
  set assigned_numbers = v_numbers
  where id = v_request_id;

  -- 5. ⚡ SINCRONIZAR CONTEO EN RIFAS (NUEVO)
  perform public.sync_raffle_sold_count(p_raffle_id);

  return v_request_id;
end;
$$;

-- 3. Actualizar RPC: approve_purchase
create or replace function public.approve_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
declare
  v_raffle_id uuid;
begin
  if public.get_my_role() is null then
    raise exception 'Acceso denegado.';
  end if;

  select raffle_id into v_raffle_id from public.purchase_requests where id = p_request_id;

  update public.purchase_requests set status = 'approved' where id = p_request_id;
  update public.raffle_numbers set status = 'sold' where purchase_id = p_request_id;
  
  -- ⚡ Sincronizar (Cifra ya incluye sold)
  perform public.sync_raffle_sold_count(v_raffle_id);
end;
$$;

-- 4. Actualizar RPC: reject_purchase
create or replace function public.reject_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
declare
  v_raffle_id uuid;
begin
  if public.get_my_role() is null then
    raise exception 'Acceso denegado.';
  end if;

  select raffle_id into v_raffle_id from public.purchase_requests where id = p_request_id;

  update public.purchase_requests set status = 'rejected', assigned_numbers = null where id = p_request_id;
  update public.raffle_numbers set status = 'available', purchase_id = null where purchase_id = p_request_id;

  -- ⚡ Sincronizar (Cifra bajará porque se liberaron los reserved)
  perform public.sync_raffle_sold_count(v_raffle_id);
end;
$$;

-- 5. Actualizar RPC: save_raffle (Corregir conteo en creación/edición)
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
  select role into v_user_role from public.admins where user_id = auth.uid();
  if v_user_role is null or v_user_role != 'superadmin' then
    raise exception 'Acceso denegado. Se requiere rol superadmin.';
  end if;

  v_raffle_id := coalesce((p_raffle->>'id')::uuid, gen_random_uuid());
  v_new_total := (p_raffle->>'total_tickets')::integer;
  v_status := coalesce(p_raffle->>'status', 'active');

  -- 📊 Conteo actual de NO DISPONIBLES (reserved + sold)
  select count(*) into v_sold_count from public.raffle_numbers 
  where raffle_id = v_raffle_id and status in ('reserved', 'sold');

  if v_new_total < v_sold_count then
    v_new_total := v_sold_count;
  end if;

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

  if not exists (select 1 from public.raffle_numbers where raffle_id = v_raffle_id and status = 'available') then
      v_status := 'sold_out';
  end if;

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

-- Sincronización Inicial para corregir discrepancias actuales
do $$
declare
  r record;
begin
  for r in select id from public.raffles loop
    perform public.sync_raffle_sold_count(r.id);
  end loop;
end;
$$;
