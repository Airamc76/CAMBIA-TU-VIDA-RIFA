-- 🚨 UPDATE TO 5-DIGIT RANDOM LOGIC 🚨

-- 1. Update Trigger Function
-- Now generates 'total_tickets' UNIQUE numbers drawn randomly from 00000-99999
create or replace function public.generate_raffle_numbers()
returns trigger as $$
begin
  -- Check if total_tickets exceeds 5-digit capacity
  if new.total_tickets > 100000 then
     raise exception 'Para 5 dígitos, el máximo de tickets es 100,000.';
  end if;

  insert into public.raffle_numbers (raffle_id, number, status)
  select new.id, num, 'available'
  from generate_series(0, 99999) as t(num) -- Universe of 5 digits
  order by random()                        -- Shuffle
  limit new.total_tickets;                 -- Pick X unique numbers
  
  return new;
end;
$$ language plpgsql;

-- 2. RESET DATA for Consistency (Clean Start)
-- This deletes existing test tickets/purchases to regenerate them with the new logic.
truncate table public.raffle_numbers cascade;
delete from public.purchase_requests; -- Cascade handles this but being explicit

-- 3. REGENERATE for Existing Active Raffles
do $$
declare
  r record;
begin
  for r in select * from public.raffles loop
    insert into public.raffle_numbers (raffle_id, number, status)
    select r.id, num, 'available'
    from generate_series(0, 99999) as t(num)
    order by random()
    limit r.total_tickets;
  end loop;
end;
$$;
