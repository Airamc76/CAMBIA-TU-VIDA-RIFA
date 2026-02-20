-- 👥 AUTOMATIZACIÓN Y SINCRONIZACIÓN DE STAFF (FINAL) 👥
-- Este script asegura que todos los usuarios de Auth existan en la tabla de admins
-- y crea un trigger para automatizar el proceso a futuro.

-- 1. Función de Sincronización Automática (Trigger)
create or replace function public.handle_new_admin_user()
returns trigger 
language plpgsql
security definer set search_path = public
as $$
begin
  -- Solo insertamos si no existe ya (evitar duplicados)
  insert into public.admins (user_id, role)
  values (new.id, 'pagos')
  on conflict (user_id) do nothing;
  
  return new;
end;
$$;

-- 2. Crear el Trigger en auth.users
-- Nota: En Supabase, el trigger debe estar en el esquema auth pero se define desde public
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_admin_user();

-- 3. Sincronización Manual (Fix para usuarios actuales)
-- Corregimos el typo de airamcrespo111 y añadimos al admin de pagos
do $$
declare
  u record;
begin
  -- airamcrespo111@gmail.com (El anterior tenía un 1 de menos)
  insert into public.admins (user_id, role)
  select id, 'pagos'
  from auth.users
  where email = 'airamcrespo111@gmail.com'
  on conflict (user_id) do update set role = 'pagos';

  -- admin_pagos@cambiatuvida.com
  insert into public.admins (user_id, role)
  select id, 'pagos'
  from auth.users
  where email = 'admin_pagos@cambiatuvida.com'
  on conflict (user_id) do update set role = 'pagos';

  -- Asegurar que Mathias esté (por si acaso)
  insert into public.admins (user_id, role)
  select id, 'pagos'
  from auth.users
  where email = 'mathiasameneiro@gmail.com'
  on conflict (user_id) do update set role = 'pagos';

  -- Forzar sincronización de CUALQUIER otro usuario que esté en AUTH pero no en ADMINS
  -- (Como red de seguridad definitiva)
  for u in 
    select id from auth.users 
    where id not in (select user_id from public.admins)
  loop
    insert into public.admins (user_id, role)
    values (u.id, 'pagos');
  end loop;

end $$;

-- 4. Permisos
grant all on public.admins to service_role;
grant select on public.admins to authenticated;
