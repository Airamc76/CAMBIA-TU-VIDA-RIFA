-- 🚨 SOFT DELETE SUPPORT 🚨
-- Update check constraint to allow 'deleted' status for raffles

ALTER TABLE public.raffles 
DROP CONSTRAINT IF EXISTS raffles_status_check;

ALTER TABLE public.raffles
ADD CONSTRAINT raffles_status_check 
CHECK (status IN ('active', 'paused', 'closed', 'drawn', 'sold_out', 'deleted'));

COMMENT ON COLUMN public.raffles.status IS 'active, paused, closed, drawn, sold_out, deleted (soft delete)';
