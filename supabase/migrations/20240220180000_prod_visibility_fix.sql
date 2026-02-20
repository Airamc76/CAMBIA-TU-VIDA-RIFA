-- 🚨 FIX FINAL VISIBILIDAD Y RLS (PRODUCCIÓN) 🚨
-- Este script resuelve el bloqueo de visualización en el panel admin y la consulta de invitados.

-- 1. Asegurar que get_my_role sea infalible y SECURITY DEFINER
create or replace function public.get_my_role()
returns text language plpgsql security definer 
set search_path = public
as $$
begin
  return (select role from public.admins where user_id = auth.uid());
end;
$$;

grant execute on function public.get_my_role to authenticated, anon;

-- 2. AJUSTE DE RLS EN purchase_requests
-- Queremos que: 
-- a) Admins vean TODO.
-- b) Usuarios logueados vean lo propio (por user_id).
-- c) Invitados vean lo propio (por DNI + Email) - Esto se maneja mejor vía RPC definer, 
--    pero damos un acceso base seguro.

alter table public.purchase_requests enable row level security;

drop policy if exists "Admins View All" on public.purchase_requests;
drop policy if exists "Users View Own" on public.purchase_requests;

-- Política para Admins (Usa la función definer para evitar recursión)
create policy "Admins View All"
on public.purchase_requests for all
using ( (select public.get_my_role()) is not null );

-- Política para Usuarios Propios (Logueados)
create policy "Users View Own"
on public.purchase_requests for select
using ( auth.uid() = user_id );

-- 3. RE-IMPLEMENTACIÓN DE get_my_tickets (SECURITY DEFINER)
-- Esto permite que invitados consulten sin que RLS les bloquee, 
-- ya que la función corre con permisos de sistema pero filtra estrictamente por DNI+Email.
create or replace function public.get_my_tickets(p_dni text, p_email text)
returns table (
  id uuid,
  full_name text,
  raffle_title text,
  raffle_total_tickets integer,
  ticket_qty integer,
  amount numeric,
  status text,
  reference text,
  receipt_path text,
  assigned_numbers jsonb,
  created_at timestamp with time zone
) language plpgsql security definer
set search_path = public
as $$
begin
  return query
  select 
    pr.id,
    pr.full_name,
    r.title as raffle_title,
    r.total_tickets as raffle_total_tickets,
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

grant execute on function public.get_my_tickets to anon, authenticated;

-- 4. RE-IMPLEMENTACIÓN DE get_admin_requests_full (SECURITY DEFINER)
-- Aseguramos que sea JSON para evitar errores 406 en navegadores antiguos
create or replace function public.get_admin_requests_full(p_status text default null)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  result json;
begin
  -- Solo admins pueden llamar a esto
  if (select public.get_my_role()) is null then
    raise exception 'Acceso denegado: No eres administrador.';
  end if;

  select coalesce(json_agg(t), '[]'::json)
  into result
  from (
    select
      pr.id, pr.raffle_id, pr.user_id, pr.full_name, pr.national_id, pr.email, pr.whatsapp,
      pr.ticket_qty, pr.amount, pr.payment_method, pr.reference, pr.receipt_path,
      pr.status, pr.created_at, pr.assigned_numbers,
      coalesce(r.title, 'Rifa Eliminada/Desconocida') as raffle_title
    from public.purchase_requests pr
    left join public.raffles r on pr.raffle_id = r.id
    where (p_status is null or pr.status = p_status)
    order by pr.created_at desc
  ) t;

  return result;
end;
$$;

grant execute on function public.get_admin_requests_full to authenticated;
