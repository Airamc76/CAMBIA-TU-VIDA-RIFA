-- PATCH: Add missing columns for Raffle creation
alter table public.raffles add column if not exists prizes text[];
alter table public.raffles add column if not exists currency text default 'Bs';
