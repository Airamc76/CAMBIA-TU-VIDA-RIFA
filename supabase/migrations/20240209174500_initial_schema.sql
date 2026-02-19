-- CLEANUP: Drop tables if they exist to ensure fresh schema
drop function if exists public.get_my_tickets cascade;
drop table if exists public.purchase_requests cascade;
drop table if exists public.raffles cascade;
drop table if exists public.admins cascade;

-- Create admins table
create table public.admins (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('superadmin', 'pagos')),
  created_at timestamp with time zone not null default now(),
  primary key (id),
  unique (user_id)
);

-- Create raffles table
create table public.raffles (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text,
  ticket_price numeric not null,
  total_tickets integer not null,
  sold_tickets integer not null default 0,
  status text not null check (status in ('active', 'paused', 'closed', 'drawn', 'sold_out')),
  draw_date timestamp with time zone,
  cover_url text,
  created_at timestamp with time zone not null default now(),
  primary key (id)
);

-- Create purchase_requests table
create table public.purchase_requests (
  id uuid not null default gen_random_uuid(),
  raffle_id uuid not null references public.raffles(id),
  user_id uuid references auth.users(id),
  full_name text not null,
  national_id text not null,
  email text not null,
  whatsapp text,
  ticket_qty integer not null,
  amount numeric not null,
  payment_method text not null,
  reference text,
  receipt_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone not null default now(),
  assigned_numbers jsonb, 
  primary key (id)
);

-- Enable RLS
alter table public.admins enable row level security;
alter table public.raffles enable row level security;
alter table public.purchase_requests enable row level security;

-- Policies (Basic)
create policy "Public raffles are viewable by everyone." on public.raffles for select using (true);
create policy "Purchase requests are viewable by own user or creators." on public.purchase_requests for select using (auth.uid() = user_id);
-- Note: 'creators' logic usually requires checking admins table, omitting strictly for now to avoid complexity, relying on admin function for approval

-- Storage bucket 'comprobantes' (needs to be created via API or SQL if extensions allowed, usually via dashboard is safer, but here is SQL attempt)
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', true) on conflict do nothing;
-- Fix storage policy conflict
-- This migration handles the case where the policy already exists

DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Public upload" ON storage.objects;
    DROP POLICY IF EXISTS "Public view" ON storage.objects;
    
    -- Recreate the policies
    CREATE POLICY "Public upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'comprobantes');
    CREATE POLICY "Public view" ON storage.objects
    FOR SELECT USING (bucket_id = 'comprobantes');
END $$;

-- Function get_my_tickets
create or replace function public.get_my_tickets(p_dni text, p_email text)
returns table (
  id uuid,
  raffle_title text,
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
