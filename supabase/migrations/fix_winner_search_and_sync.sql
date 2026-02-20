-- 🔧 FIX COMPLETO: SYNC TABLAS + BACKFILL JSONB + BUSCADOR ROBUSTO
-- Este script alinea 'raffle_numbers' (relacional) con 'purchase_requests' (JSONB)
-- y asegura que el buscador funcione con datos históricos y nuevos.

-- ──────────────────────────────────────────
-- PASO 1: Sincronizar raffle_numbers 'reserved' -> 'sold' para compras aprobadas
-- (Corrige inconsistencia de estados en tabla relacional)
-- ──────────────────────────────────────────
update public.raffle_numbers rn
set status = 'sold'
where rn.status = 'reserved'
  and exists (
    select 1 from public.purchase_requests pr
    where pr.id = rn.purchase_id
      and pr.status = 'approved'
  );

-- ──────────────────────────────────────────
-- PASO 2: BACKFILL DE DATOS (CRÍTICO PARA HISTORIAL)
-- Rellena 'assigned_numbers' en purchase_requests usando la data de raffle_numbers.
-- Esto permite que los tickets viejos aparezcan en el buscador y el frontend.
-- ──────────────────────────────────────────
with computed_numbers as (
  select 
    purchase_id, 
    jsonb_agg(number order by number) as numbers_json
  from public.raffle_numbers
  group by purchase_id
)
update public.purchase_requests pr
set assigned_numbers = cn.numbers_json
from computed_numbers cn
where pr.id = cn.purchase_id
  and pr.status = 'approved'
  and (pr.assigned_numbers is null or pr.assigned_numbers = '[]'::jsonb);

-- ──────────────────────────────────────────
-- PASO 3: RPC search_ticket_winner V3 (FINAL)
-- Busca EXCLUSIVAMENTE en assigned_numbers (ahora confiable gracias al paso 2).
-- Devuelve data formateada para AdminPagos.tsx
-- ──────────────────────────────────────────
drop function if exists public.search_ticket_winner(uuid, integer);

create or replace function public.search_ticket_winner(p_raffle_id uuid, p_number int)
returns table (
  full_name text,
  national_id text,
  email text,
  whatsapp text,
  ticket_status text,
  purchase_status text,
  raffle_title text,
  assigned_numbers jsonb
) language plpgsql security definer
as $$
begin
  -- 🛡️ Solo admins pueden buscar ganadores
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Acceso denegado.';
  end if;

  return query
  select
    pr.full_name,
    pr.national_id,
    pr.email,
    pr.whatsapp,
    -- Estado: Si está en assigned_numbers y la compra es approved, es 'sold'.
    -- El frontend maneja 'assigned' como fallback, pero aquí confirmamos venta.
    'sold' as ticket_status, 
    pr.status::text as purchase_status,
    r.title as raffle_title,
    pr.assigned_numbers
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  where pr.raffle_id = p_raffle_id
    and pr.status = 'approved'
    -- Búsqueda eficiente en JSONB (Indexable con GIN si fuera necesario)
    and pr.assigned_numbers @> jsonb_build_array(p_number)
  limit 1;
end;
$$;

grant execute on function public.search_ticket_winner to authenticated;
