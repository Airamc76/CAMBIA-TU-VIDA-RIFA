
-- 🔒 VALIDACIÓN DE REFERENCIA ÚNICA (6 DÍGITOS) 🔒
-- Esta migración actualiza create_purchase_request para impedir duplicados reales en tiempo de compra.

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
  v_clean_ref text;
begin
  -- 1. Limpiar y Validar Referencia (Últimos 6 dígitos exactos)
  v_clean_ref := regexp_replace(p_reference, '\D', '', 'g'); -- Solo números
  
  if length(v_clean_ref) != 6 then
    raise exception 'Debe ingresar exactamente los últimos 6 dígitos de su referencia bancaria.';
  end if;

  -- 2. Verificar si la referencia ya fue usada (Evitar Fraude)
  if exists (
    select 1 from public.purchase_requests 
    where reference = v_clean_ref 
      and status != 'rejected' -- Permitir reintentar si el anterior fue rechazado
  ) then
    raise exception 'REFERENCIA_DUPLICADA';
  end if;

  -- 3. Validar estado rifa
  select status into v_raffle_status from public.raffles where id = p_raffle_id;
  if v_raffle_status != 'active' then
    raise exception 'La rifa no está activa (%s).', v_raffle_status;
  end if;

  -- 4. Verificar disponibilidad
  if (select count(*) from public.raffle_numbers where raffle_id = p_raffle_id and status = 'available') < p_ticket_qty then
    raise exception 'No hay suficientes tickets disponibles.';
  end if;

  -- 5. Insertar Request (Status pending) usando v_clean_ref
  insert into public.purchase_requests (
    raffle_id, full_name, national_id, email, whatsapp, 
    ticket_qty, amount, payment_method, reference, receipt_path, 
    status, user_id
  ) values (
    p_raffle_id, p_full_name, p_national_id, p_email, p_whatsapp, 
    p_ticket_qty, p_amount, p_payment_method, v_clean_ref, p_receipt_path, 
    'pending', auth.uid()
  ) returning id into v_request_id;

  -- 6. Reservar Números (Status reserved)
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

  -- 7. GUARDAR assigned_numbers (JSONB)
  select jsonb_agg(number order by number) into v_numbers
  from public.raffle_numbers
  where purchase_id = v_request_id;

  update public.purchase_requests
  set assigned_numbers = v_numbers
  where id = v_request_id;

  -- 8. ⚡ Sincronizar conteo
  perform public.sync_raffle_sold_count(p_raffle_id);

  return v_request_id;
end;
$$;
