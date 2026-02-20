-- 🕵️ CHECK DB STATE
-- Verificar si existen solicitudes de compra y rifas
select 'purchase_requests' as table_name, count(*) as count from public.purchase_requests
union all
select 'raffles' as table_name, count(*) as count from public.raffles
union all
select 'raffle_numbers' as table_name, count(*) as count from public.raffle_numbers;

-- Ver las últimas 5 solicitudes si existen, para ver status/user_id
select id, full_name, status, user_id, created_at 
from public.purchase_requests 
order by created_at desc 
limit 5;
