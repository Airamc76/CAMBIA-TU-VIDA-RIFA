
-- 🕊️ ACTUALIZACIÓN: NÚMEROS BENDECIDOS POR RIFA 🕊️
-- Permite que las reservas sean específicas de una campaña.

-- 1. Modificar tabla para incluir raffle_id
alter table public.blessed_numbers drop constraint if exists blessed_numbers_number_key;
alter table public.blessed_numbers add column if not exists raffle_id uuid references public.raffles(id) on delete cascade;
-- Eliminar duplicados si los hay antes de poner el constraint (opcional en ambiente limpio)
alter table public.blessed_numbers add constraint blessed_numbers_raffle_number_unique unique(raffle_id, number);

-- 2. Actualizar RPC de estado
drop function if exists public.get_blessed_numbers_status();

create or replace function public.get_blessed_numbers_status()
returns table (
  blessed_id uuid,
  number int,
  is_reserved boolean,
  raffle_id uuid,
  raffle_title text,
  owners jsonb
) language plpgsql security definer as $$
begin
  if public.get_my_role() is null then
    raise exception 'No autorizado';
  end if;

  return query
  select 
    bn.id as blessed_id,
    bn.number,
    bn.is_reserved,
    bn.raffle_id,
    r_bn.title as raffle_title,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'raffle_title', r.title,
          'user_name', pr.full_name,
          'status', pr.status,
          'whatsapp', pr.whatsapp
        ))
        from public.raffle_numbers rn
        join public.purchase_requests pr on rn.purchase_id = pr.id
        join public.raffles r on pr.raffle_id = r.id
        where rn.number = bn.number
        and rn.raffle_id = bn.raffle_id -- Cruce exacto por rifa
        and pr.status = 'approved'
      ),
      '[]'::jsonb
    ) as owners
  from public.blessed_numbers bn
  left join public.raffles r_bn on bn.raffle_id = r_bn.id
  order by bn.created_at desc;
end;
$$;

-- 3. Actualizar create_purchase_request para filtrar por rifa específica
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
  -- 1. Limpiar y Validar Referencia
  v_clean_ref := regexp_replace(p_reference, '\D', '', 'g'); 
  
  if length(v_clean_ref) != 6 then
    raise exception 'Debe ingresar exactamente los últimos 6 dígitos de su referencia bancaria.';
  end if;

  -- 2. Verificar duplicados
  if exists (
    select 1 from public.purchase_requests 
    where reference = v_clean_ref 
      and status != 'rejected'
  ) then
    raise exception 'REFERENCIA_DUPLICADA';
  end if;

  -- 3. Validar estado rifa
  select status into v_raffle_status from public.raffles where id = p_raffle_id;
  if v_raffle_status != 'active' then
    raise exception 'La rifa no está activa (%s).', v_raffle_status;
  end if;

  -- 4. Verificar disponibilidad (Filtrando bendecidos de ESTA rifa o globales sin rifa_id)
  if (
    select count(*) 
    from public.raffle_numbers rn
    where rn.raffle_id = p_raffle_id 
      and rn.status = 'available'
      and not exists (
        select 1 from public.blessed_numbers bn 
        where bn.number = rn.number 
          and bn.is_reserved = true 
          and (bn.raffle_id = p_raffle_id or bn.raffle_id is null)
      )
  ) < p_ticket_qty then
    raise exception 'No hay suficientes tickets disponibles (algunos están reservados por el sistema).';
  end if;

  -- 5. Insertar Request
  insert into public.purchase_requests (
    raffle_id, full_name, national_id, email, whatsapp, 
    ticket_qty, amount, payment_method, reference, receipt_path, 
    status, user_id
  ) values (
    p_raffle_id, p_full_name, p_national_id, p_email, p_whatsapp, 
    p_ticket_qty, p_amount, p_payment_method, v_clean_ref, p_receipt_path, 
    'pending', auth.uid()
  ) returning id into v_request_id;

  -- 6. Reservar Números - EXCLUYENDO BENDECIDOS DE ESTA RIFA
  with selected as (
    select rn.id, rn.number
    from public.raffle_numbers rn
    where rn.raffle_id = p_raffle_id 
      and rn.status = 'available'
      and not exists (
        select 1 from public.blessed_numbers bn 
        where bn.number = rn.number 
          and bn.is_reserved = true 
          and (bn.raffle_id = p_raffle_id or bn.raffle_id is null)
      )
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

  -- 7. GUARDAR assigned_numbers
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
