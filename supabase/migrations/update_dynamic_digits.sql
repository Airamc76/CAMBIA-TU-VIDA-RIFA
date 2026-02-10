-- 🚨 UPDATE FOR DYNAMIC TICKET DIGITS 🚨

-- 1. Update Trigger Function to use exact raffle range [0, total_tickets - 1]
create or replace function public.generate_raffle_numbers()
returns trigger as $$
begin
  insert into public.raffle_numbers (raffle_id, number, status)
  select new.id, num, 'available'
  from generate_series(0, new.total_tickets - 1) as t(num)
  order by random();
  
  return new;
end;
$$ language plpgsql;

-- 2. REGENERATE for Existing Active Raffles
-- Note: This is a destructive operation (resets tickets), but necessary for consistency.
do $$
declare
  r record;
begin
  -- Clear existing numbers as they might be out of new range or 5-digit centered
  truncate table public.raffle_numbers cascade;
  
  for r in select * from public.raffles loop
    insert into public.raffle_numbers (raffle_id, number, status)
    select r.id, num, 'available'
    from generate_series(0, r.total_tickets - 1) as t(num)
    order by random();
  end loop;
end;
$$;

-- 3. Update get_my_tickets to return total_tickets (needed for dynamic padding)
drop function if exists public.get_my_tickets(text, text);

create or replace function public.get_my_tickets(p_dni text, p_email text)
returns table (
  id uuid,
  raffle_title text,
  raffle_total_tickets integer,
  ticket_qty integer,
  amount numeric,
  status text,
  reference text,
  receipt_path text,
  assigned_numbers jsonb,
  created_at timestamp with time zone
) language plpgsql security definer
as $$
begin
  return query
  select 
    pr.id,
    r.title as raffle_title,
    r.total_tickets as raffle_total_tickets,
    pr.ticket_qty,
    pr.amount,
    pr.status,
    pr.reference,
    pr.receipt_path,
    pr.assigned_numbers,
    pr.created_at
  from public.purchase_requests pr
  join public.raffles r on pr.raffle_id = r.id
  where pr.national_id = p_dni and lower(pr.email) = lower(p_email);
end;
$$;
