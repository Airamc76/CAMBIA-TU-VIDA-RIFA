-- 🕵️ DEBUG PROFUNDO
-- Vamos a revisar por qué la RPC no devuelve nada o si falla.

-- 1. Ver qué roles ve la base de datos para tu usuario
select 
  auth.uid() as my_uid,
  public.get_my_role() as my_role_via_func,
  (select role from public.admins where user_id = auth.uid()) as raw_role_query;

-- 2. Ver estados reales en la tabla (por si hay espacios o mayúsculas)
select distinct status from public.purchase_requests;

-- 3. Probar la RPC directamente (simulando ser tú)
-- Nota: Esto solo funciona si ejecutas en el editor SQL de Supabase autenticado, 
-- pero nos dará una idea si ejecutamos sin auth.

-- Si eres anon/service_role en el editor SQL, esto podría fallar por el check de permisos de la RPC.
-- Vamos a hacer una versión "insegura" TEMPORAL de la RPC para ver si es el código o los permisos.

create or replace function public.debug_fetch_requests()
returns table (id uuid, status text, raffle_title text)
language plpgsql security definer
as $$
begin
  return query
  select pr.id, pr.status, r.title::text
  from public.purchase_requests pr
  left join public.raffles r on pr.raffle_id = r.id;
end;
$$;

-- Ejecutar la prueba
select * from public.debug_fetch_requests();

-- 4. Borrar la función de debug
drop function public.debug_fetch_requests();
