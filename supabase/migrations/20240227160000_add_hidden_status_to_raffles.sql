-- 🔒 ADD 'HIDDEN' STATUS TO RAFFLES 🔒
-- Esto permite pre-crear rifas sin que sean visibles al público.

ALTER TABLE public.raffles 
DROP CONSTRAINT IF EXISTS raffles_status_check;

ALTER TABLE public.raffles 
ADD CONSTRAINT raffles_status_check 
CHECK (status IN ('active', 'paused', 'closed', 'drawn', 'sold_out', 'deleted', 'hidden'));

COMMENT ON COLUMN public.raffles.status IS 'active, paused, closed, drawn, sold_out, deleted (soft delete), hidden (admin only)';
