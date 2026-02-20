-- 👑 FIX ROOT ACCESS: Promover usuario a SuperAdmin
-- Este script asegura que tu usuario tenga permisos de ROOT para acceder al panel.

-- 1. Asegurar que la función get_my_role existe y es accesible
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

-- 2. Asignar ROL 'superadmin' a tu correo
-- INSERT o UPDATE (Upsert) en la tabla admins usando el UUID de auth.users
insert into public.admins (user_id, role)
select id, 'superadmin' 
from auth.users 
where email = 'airamc@tiforbi.com'
on conflict (user_id) do update set role = 'superadmin';

-- 3. Verificación rápida (solo para log)
do $$
declare
  v_role text;
begin
  select role into v_role from public.admins 
  where user_id = (select id from auth.users where email = 'airamc@tiforbi.com');
  
  if v_role = 'superadmin' then
    raise notice '✅ Usuario airamc@tiforbi.com es ahora SUPERADMIN';
  else
    raise notice '⚠️ No se encontró el usuario o no se pudo actualizar';
  end if;
end $$;
