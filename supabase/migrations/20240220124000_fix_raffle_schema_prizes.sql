-- 🎟️ FIX: MISSING COLUMNS IN RAFFLES 🎟️
-- Adds 'prizes' and 'currency' columns to the raffles table.

ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS prizes text[] DEFAULT '{}';
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS currency text DEFAULT 'Bs';
