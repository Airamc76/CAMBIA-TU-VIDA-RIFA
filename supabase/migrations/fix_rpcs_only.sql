-- 🛠️ FIX RPCs: ASEGURAR LÓGICA DE NEGOCIO (Sín Tocar RLS)
-- Este script actualiza las funciones críticas para gestión de rifas.

-- 1. CREATE PURCHASE (Con asignación atómica de números)
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
  -- Usamos FOR UPDATE SKIP LOCKED para concurrencia segura
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

  -- Verificar si se reservaron todos
  if (select count(*) from public.raffle_numbers where purchase_id = v_request_id) < p_ticket_qty then
    raise exception 'tickets_sold_out'; -- Trigger especial para frontend
  end if;

  -- 4. GUARDAR assigned_numbers (JSONB)
  select jsonb_agg(number order by number) into v_numbers
  from public.raffle_numbers
  where purchase_id = v_request_id;

  update public.purchase_requests
  set assigned_numbers = v_numbers
  where id = v_request_id;

  return v_request_id;
end;
$$;

-- 2. APPROVE (Confirma venta y libera números sold)
create or replace function public.approve_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
declare
  v_raffle_id uuid;
begin
  -- Solo admins (usando get_my_role para consistencia)
  if public.get_my_role() is null then
    raise exception 'Acceso denegado.';
  end if;

  select raffle_id into v_raffle_id from public.purchase_requests where id = p_request_id;

  -- Actualizar Request
  update public.purchase_requests
  set status = 'approved'
  where id = p_request_id;

  -- Actualizar Números a SOLD
  update public.raffle_numbers
  set status = 'sold'
  where purchase_id = p_request_id;
  
  -- Lógica Sold Out
  if (select count(*) from public.raffle_numbers where raffle_id = v_raffle_id and status = 'available') = 0 then
    update public.raffles set status = 'sold_out' where id = v_raffle_id;
  end if;
end;
$$;

-- 3. REJECT (Libera números)
create or replace function public.reject_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Solo admins
  if public.get_my_role() is null then
    raise exception 'Acceso denegado.';
  end if;

  -- Actualizar Request
  update public.purchase_requests
  set status = 'rejected'
  where id = p_request_id;

  -- Liberar Números
  update public.raffle_numbers
  set status = 'available', purchase_id = null
  where purchase_id = p_request_id;
end;
$$;

grant execute on function public.create_purchase_request to anon, authenticated, service_role;
grant execute on function public.approve_purchase to authenticated, service_role;
grant execute on function public.reject_purchase to authenticated, service_role;
