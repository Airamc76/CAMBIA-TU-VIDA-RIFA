-- 🚨 RAFFLE ENGINE IMPLEMENTATION (FINAL) 🚨

-- 1. TABLE: raffle_numbers
create table if not exists public.raffle_numbers (
  id uuid not null default gen_random_uuid(),
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  number integer not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  purchase_id uuid references public.purchase_requests(id) on delete set null,
  updated_at timestamp with time zone default now(),
  primary key (id),
  unique (raffle_id, number)
);

create index if not exists idx_raffle_numbers_status on public.raffle_numbers(raffle_id, status);
create index if not exists idx_raffle_numbers_purchase on public.raffle_numbers(purchase_id);

-- 2. TRIGGER: Generate numbers on Raffle Creation
create or replace function public.generate_raffle_numbers()
returns trigger as $$
begin
  insert into public.raffle_numbers (raffle_id, number, status)
  select new.id, generate_series(1, new.total_tickets), 'available';
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_raffle_created on public.raffles;
create trigger on_raffle_created
  after insert on public.raffles
  for each row
  execute function public.generate_raffle_numbers();

-- 3. BACKFILL for Existing Raffles (Important!)
do $$
declare
  r record;
begin
  for r in select * from public.raffles loop
    if not exists (select 1 from public.raffle_numbers where raffle_id = r.id) then
      insert into public.raffle_numbers (raffle_id, number, status)
      select r.id, generate_series(1, r.total_tickets), 'available';
    end if;
  end loop;
end;
$$;

-- 4. RPC: Create Purchase Request (With Atomic Reservation)
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
  -- Validate Raffle Status
  select status into v_raffle_status from public.raffles where id = p_raffle_id;
  if v_raffle_status != 'active' then
    raise exception 'La rifa no está activa (%s).', v_raffle_status;
  end if;

  -- 1. Check availability
  if (select count(*) from public.raffle_numbers where raffle_id = p_raffle_id and status = 'available') < p_ticket_qty then
    raise exception 'No hay suficientes tickets disponibles.';
  end if;

  -- 2. Insert Request (Initial)
  insert into public.purchase_requests (
    raffle_id, full_name, national_id, email, whatsapp, 
    ticket_qty, amount, payment_method, reference, receipt_path, 
    status, user_id
  ) values (
    p_raffle_id, p_full_name, p_national_id, p_email, p_whatsapp, 
    p_ticket_qty, p_amount, p_payment_method, p_reference, p_receipt_path, 
    'pending', auth.uid()
  ) returning id into v_request_id;

  -- 3. Reserve Numbers (Atomic & Random)
  with selected as (
    select id, number
    from public.raffle_numbers
    where raffle_id = p_raffle_id and status = 'available'
    order by random() -- 🎲 Real Random DB
    limit p_ticket_qty
    for update skip locked -- 🔒 Concurrency Lock
  )
  update public.raffle_numbers
  set status = 'reserved', purchase_id = v_request_id, updated_at = now()
  from selected
  where public.raffle_numbers.id = selected.id;

  -- Verify reservation
  if (select count(*) from public.raffle_numbers where purchase_id = v_request_id) < p_ticket_qty then
    raise exception 'Lo sentimos, los tickets se acaban de agotar o no hay suficientes disponibles. Por favor, intenta con una cantidad menor o refresca la página.';
  end if;

  -- 4. Store assigned numbers in request for easy display
  select jsonb_agg(number order by number) into v_numbers
  from public.raffle_numbers
  where purchase_id = v_request_id;

  update public.purchase_requests
  set assigned_numbers = v_numbers
  where id = v_request_id;

  return v_request_id;
end;
$$;

-- 5. RPC: Approve Purchase
create or replace function public.approve_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
declare
  v_raffle_id uuid;
begin
  -- Permission check
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Acceso denegado.';
  end if;

  select raffle_id into v_raffle_id from public.purchase_requests where id = p_request_id;

  -- Update Request
  update public.purchase_requests
  set status = 'approved'
  where id = p_request_id;

  -- Update Numbers
  update public.raffle_numbers
  set status = 'sold'
  where purchase_id = p_request_id;
  
  -- AUTO-CLOSE Logic
  if (select count(*) from public.raffle_numbers where raffle_id = v_raffle_id and status = 'available') = 0 then
    update public.raffles set status = 'sold_out' where id = v_raffle_id;
  end if;
end;
$$;

-- 6. RPC: Reject Purchase
create or replace function public.reject_purchase(p_request_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Permission check
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Acceso denegado.';
  end if;

  -- Update Request
  update public.purchase_requests
  set status = 'rejected'
  where id = p_request_id;

  -- Release Numbers
  update public.raffle_numbers
  set status = 'available', purchase_id = null
  where purchase_id = p_request_id;
end;
$$;

-- Grant permissions (Crucial)
grant execute on function public.create_purchase_request to anon, authenticated, service_role;
grant execute on function public.approve_purchase to authenticated, service_role;
grant execute on function public.reject_purchase to authenticated, service_role;

-- RLS
alter table public.raffle_numbers enable row level security;
drop policy if exists "Public view numbers" on public.raffle_numbers;
create policy "Public view numbers" on public.raffle_numbers for select using (true);
