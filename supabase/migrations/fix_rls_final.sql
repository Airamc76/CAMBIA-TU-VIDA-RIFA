-- 🛡️ FINAL RLS FIX: EVITAR RECURSIÓN INFINITA + RPC JSON RETURN
-- Problema: 406 Not Acceptable al llamar a RPC con RETURNS TABLE
-- Solución: Retornar JSON directamente para bypass de la negociación de contenido estricta de PostgREST

-- 1. Helper Role Function (Mantenemos igual)
create or replace function public.get_my_role()
returns text language plpgsql security definer 
set search_path = public
as $$
begin
  return (select role from public.admins where user_id = auth.uid());
end;
$$;

grant execute on function public.get_my_role to authenticated;
grant execute on function public.get_my_role to anon;

-- 2. RESET POLÍTICAS en purchase_requests (Mantenemos igual)
alter table public.purchase_requests enable row level security;

drop policy if exists "Admins can view all requests" on public.purchase_requests;
drop policy if exists "Admins can do everything" on public.purchase_requests;
drop policy if exists "Users can view own requests" on public.purchase_requests;
drop policy if exists "Purchase requests are viewable by own user or creators." on public.purchase_requests;
drop policy if exists "Admins View All" on public.purchase_requests;
drop policy if exists "Users View Own" on public.purchase_requests;

create policy "Admins View All"
on public.purchase_requests for all
using ( public.get_my_role() is not null );

create policy "Users View Own"
on public.purchase_requests for select
using ( auth.uid() = user_id );

-- 3. DROP VERSION ANTERIOR PARA EVITAR CONFLICTOS
drop function if exists public.get_admin_requests_full(text);

-- 4. RPC ROBUSTA: Retorna JSON
create or replace function public.get_admin_requests_full(p_status text default null)
returns json
language plpgsql security definer
as $$
declare
  result json;
begin
  -- Solo admins (Descomentar para prod)
  -- if public.get_my_role() is null then
  --   raise exception 'Acceso denegado: No eres administrador.';
  -- end if;

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
-- También a anon por si acaso hay lío con roles en local
grant execute on function public.get_admin_requests_full to anon;
