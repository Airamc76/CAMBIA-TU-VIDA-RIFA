-- 👤 ADMIN LOGIN & ROLE FIX (SECURITY ADD-ON)

-- 1. Create a secure way to get roles without RLS issues
create or replace function public.get_my_role()
returns text language plpgsql security definer 
set search_path = public
as $$
begin
  return (select role from public.admins where user_id = auth.uid());
end;
$$;

-- 2. Grant permission to use this RPC
grant execute on function public.get_my_role to authenticated;

-- 3. Ensure the current user has the correct role (MASTER FIX)
-- CAMBIA 'airamcrespo11@gmail.com' por el correo que falló si es necesario
insert into public.admins (user_id, role)
select id, 'pagos' 
from auth.users 
where email = 'airamcrespo11@gmail.com'
on conflict (user_id) do update set role = 'pagos';

-- 4. Enable RLS and add basic select policy for ADMiNS (Backup)
alter table public.admins enable row level security;

drop policy if exists "Admins can view their own record" on public.admins;
create policy "Admins can view their own record" 
on public.admins for select 
using (auth.uid() = user_id);
