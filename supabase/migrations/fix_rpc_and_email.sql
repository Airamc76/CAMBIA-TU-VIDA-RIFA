-- 🚨 FIX DEFINITIVO: FUNCIÓN FALTANTE Y CORREO 🚨

-- 1. Crear la función get_my_role (Asegúrate de ejecutar esto en el SQL Editor)
create or replace function public.get_my_role()
returns text language plpgsql security definer 
set search_path = public
as $$
begin
  return (select role from public.admins where user_id = auth.uid());
end;
$$;

-- 2. Darle permisos públicos para que la web pueda leerla
grant execute on function public.get_my_role to anon;
grant execute on function public.get_my_role to authenticated;

-- 3. Arreglar el correo (He visto que usas airamcrespo111@gmail.com y airamcrespo11@gmail.com)
-- Vamos a dar permiso a ambos por si acaso hay un typo:
insert into public.admins (user_id, role)
select id, 'pagos' from auth.users where email in ('airamcrespo111@gmail.com', 'airamcrespo11@gmail.com')
on conflict (user_id) do update set role = 'pagos';

-- 4. Asegurarnos que la tabla es legible por el dueño
alter table public.admins enable row level security;
drop policy if exists "Admins can view their own record" on public.admins;
create policy "Admins can view their own record" on public.admins for select using (auth.uid() = user_id);
