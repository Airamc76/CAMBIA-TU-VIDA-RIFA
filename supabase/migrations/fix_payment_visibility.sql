-- 🛠️ FIX TOTAL: VISIBILIDAD DE PAGOS + FLUJOS CORRECTOS
-- Este script arregla 3 cosas críticas:
-- 1. POLÍTICAS RLS: Asegura que el Admin vea TODOS los pagos (incluso anónimos).
-- 2. CREATE RPC: Asegura que al crear compra se guarde 'assigned_numbers' (para el buscador).
-- 3. APPROVE/REJECT: Asegura que el flujo de aprobación/rechazo sea consistente.

-- ==============================================================================
-- SECCIÓN 1: VISIBILIDAD (RLS)
-- ==============================================================================
alter table public.purchase_requests enable row level security;

-- Borrar políticas antiguas para evitar conflictos o bloqueos
drop policy if exists "Admins can view all requests" on public.purchase_requests;
drop policy if exists "Purchase requests are viewable by own user or creators." on public.purchase_requests;
drop policy if exists "Purchase requests are viewable by own user" on public.purchase_requests;

-- Política 1: El usuario dueño puede ver sus propios tickets
create policy "Users can view own requests"
on public.purchase_requests for select
using (auth.uid() = user_id);

-- Política 2: Los administradores pueden ver y editar TODO
-- Nota: La cláusula USING (true) dentro de un contexto admin garantiza visibilidad total
create policy "Admins can do everything"
on public.purchase_requests for all
using (
  exists (select 1 from public.admins where user_id = auth.uid())
);

-- ==============================================================================
-- SECCIÓN 2: AUDITORÍA DE FLUJOS (RPCs)
-- Redefinimos las funciones para estar 100% seguros de que usan la lógica nueva.
-- ==============================================================================

-- 2.1 CREATE (Con lógica assigned_numbers)
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
    -- Rollback implícito al fallar la transacción por error
    raise exception 'Error de concurrencia: Tickets agotados durante la selección. Intenta de nuevo.';
  end if;

  -- 4. GUARDAR assigned_numbers (JSONB)
  -- Esto es crucial para que search_ticket_winner funcione
  select jsonb_agg(number order by number) into v_numbers
  from public.raffle_numbers
  where purchase_id = v_request_id;

  update public.purchase_requests
  set assigned_numbers = v_numbers
  where id = v_request_id;

  return v_request_id;
end;
$$;

-- 2.2 APPROVE (Confirma venta y mantiene consistencia)
create or replace function public.approve_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
declare
  v_raffle_id uuid;
begin
  -- Solo admins
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
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

-- 2.3 REJECT (Libera números)
create or replace function public.reject_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Solo admins
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
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

-- Grant permissions (Crucial)
grant execute on function public.create_purchase_request to anon, authenticated, service_role;
grant execute on function public.approve_purchase to authenticated, service_role;
grant execute on function public.reject_purchase to authenticated, service_role;
