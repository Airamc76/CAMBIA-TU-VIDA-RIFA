
-- 🕊️ TABLA: NÚMEROS BENDECIDOS 🕊️
-- Permite reservar números específicos globalmente y monitorear sus dueños.

create table if not exists public.blessed_numbers (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  description text,
  is_reserved boolean default true,
  created_at timestamptz default now()
);

-- Insertar números iniciales pedidos por el usuario
insert into public.blessed_numbers (number, description, is_reserved)
values 
  (2222, 'Número Bendecido Reservado', true),
  (3825, 'Número Bendecido Reservado', true),
  (1448, 'Número Bendecido Reservado', true),
  (4975, 'Número Bendecido Reservado', true),
  (0526, 'Número Bendecido Liberado para Auditoría', false)
on conflict (number) do update set is_reserved = excluded.is_reserved;

-- 🛡️ POLÍTICAS RLS
alter table public.blessed_numbers enable row level security;

create policy "Admins can manage blessed numbers"
  on public.blessed_numbers
  for all 
  using (public.get_my_role() = 'superadmin');

-- 🔄 RPC: Obtener Estado de Números Bendecidos
-- Cruza los números bendecidos con las ventas reales en todas las rifas.
create or replace function public.get_blessed_numbers_status()
returns table (
  blessed_id uuid,
  number int,
  is_reserved boolean,
  owners jsonb -- Lista de quienes tienen este número en sus rifas
) language plpgsql security definer as $$
begin
  if public.get_my_role() is null then
    raise exception 'No autorizado';
  end if;

  return query
  select 
    bn.id,
    bn.number,
    bn.is_reserved,
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
        and pr.status = 'approved'
      ),
      '[]'::jsonb
    ) as owners
  from public.blessed_numbers bn
  order by bn.number asc;
end;
$$;

-- 🔄 TRIGGER: Bloquear Reserva de Números Bendecidos en create_purchase_request
-- Debemos modificar create_purchase_request para que ignore o falle si intenta elegir un número bendecido reservado.

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
  v_clean_ref := regexp_replace(p_reference, '\D', '', 'g'); 
  
  if length(v_clean_ref) != 6 then
    raise exception 'Debe ingresar exactamente los últimos 6 dígitos de su referencia bancaria.';
  end if;

  -- 2. Verificar si la referencia ya fue usada (Evitar Fraude)
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

  -- 4. Verificar disponibilidad (Excluyendo números bendecidos reservados)
  if (
    select count(*) 
    from public.raffle_numbers rn
    where rn.raffle_id = p_raffle_id 
      and rn.status = 'available'
      and not exists (select 1 from public.blessed_numbers bn where bn.number = rn.number and bn.is_reserved = true)
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

  -- 6. Reservar Números (Status reserved) - EXCLUYENDO BENDECIDOS RESERVADOS
  with selected as (
    select rn.id, rn.number
    from public.raffle_numbers rn
    where rn.raffle_id = p_raffle_id 
      and rn.status = 'available'
      and not exists (select 1 from public.blessed_numbers bn where bn.number = rn.number and bn.is_reserved = true)
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

grant execute on function public.get_blessed_numbers_status to authenticated, service_role;
