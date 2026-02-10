-- 🚨 MASTER SETUP SCRIPT (FIXED) 🚨
-- This version handles existing policies prevents errors.

-- 1. CLEANUP (Tables & Functions)
drop function if exists public.get_my_tickets cascade;
drop table if exists public.purchase_requests cascade;
drop table if exists public.raffles cascade;
drop table if exists public.admins cascade;

-- 2. SCHEMA CREATION

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

-- 3. SECURITY (RLS & POLICIES)

-- Enable RLS
alter table public.admins enable row level security;
alter table public.raffles enable row level security;
alter table public.purchase_requests enable row level security;

-- CLEANUP OLD POLICIES (Just in case)
drop policy if exists "Allow users to read their own admin role" on public.admins;
drop policy if exists "Public raffles are viewable by everyone." on public.raffles;
drop policy if exists "Admins can modify raffles" on public.raffles;
drop policy if exists "Purchase requests viewable by owner" on public.purchase_requests;
drop policy if exists "Public purchase creation" on public.purchase_requests;

-- Create Policies
create policy "Allow users to read their own admin role" 
on public.admins for select 
using (auth.uid() = user_id);

create policy "Public raffles are viewable by everyone." on public.raffles for select using (true);

create policy "Admins can modify raffles" on public.raffles for all using (
  exists (select 1 from public.admins where user_id = auth.uid() and role = 'superadmin')
);

create policy "Purchase requests viewable by owner" on public.purchase_requests for select using (auth.uid() = user_id);
create policy "Public purchase creation" on public.purchase_requests for insert with check (true);

-- 4. FUNCTIONS

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

-- 5. DATA SEEDING (Insert Admins)

insert into public.admins (user_id, role)
values
  ('78a49e02-d900-4f50-bda6-822aa6019264', 'superadmin'), -- airamc@tiforbi.com
  ('afcc40bf-11e9-4a09-bec6-265766968ca7', 'pagos')      -- admin_pagos@cambiatuvida.com
on conflict (user_id) do update
set role = excluded.role;

-- 6. STORAGE (Handled safely)

insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', true) on conflict do nothing;

drop policy if exists "Public upload" on storage.objects;
drop policy if exists "Public view" on storage.objects;

create policy "Public upload" on storage.objects for insert with check (bucket_id = 'comprobantes');
create policy "Public view" on storage.objects for select using (bucket_id = 'comprobantes');
