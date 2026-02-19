-- 🔧 FIX: BUSCADOR DE GANADORES + SINCRONIZACIÓN DE DATOS
-- Problema: tickets aprobados antes de la migración fix_raffle_depletion quedan
-- con status='reserved' en raffle_numbers, pero el buscador filtra solo status='sold'.
-- Solución: usar assigned_numbers JSONB (fuente de verdad) + sincronizar datos existentes.

-- ──────────────────────────────────────────
-- PASO 1: Sincronizar raffle_numbers 'reserved' -> 'sold' para compras aprobadas
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
-- PASO 2: Corregir el RPC search_ticket_winner
-- Usa assigned_numbers (JSONB) como fuente de verdad para encontrar al poseedor,
-- sin depender exclusivamente del estado en raffle_numbers.
-- ──────────────────────────────────────────
-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE.
-- Se debe eliminar la función antes de recrearla.
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
    -- Prioriza el estado real de raffle_numbers si existe, si no usa 'assigned'
    coalesce(rn.status::text, 'assigned') as ticket_status,
    pr.status::text as purchase_status,
    r.title as raffle_title,
    pr.assigned_numbers
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  left join public.raffle_numbers rn
    on rn.purchase_id = pr.id
    and rn.number = p_number
    and rn.raffle_id = p_raffle_id
  where pr.raffle_id = p_raffle_id
    and pr.status = 'approved'
    -- Busca en el JSONB assigned_numbers (fuente de verdad desde create_purchase_request)
    and pr.assigned_numbers @> jsonb_build_array(p_number)
  limit 1;
end;
$$;

grant execute on function public.search_ticket_winner to authenticated;
