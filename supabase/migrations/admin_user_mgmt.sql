-- 👤 ADMIN USER MANAGEMENT RPCs (RESTORATION SCRIPT)

-- 1. CLEANUP (To avoid conflicts)
drop function if exists public.get_admin_users() cascade;
drop function if exists public.reset_admin_mfa(uuid) cascade;
drop function if exists public.update_admin_role(uuid, text) cascade;

-- 2. Get Admin Users List
create or replace function public.get_admin_users()
returns table (
    id uuid,
    email text,
    role text,
    created_at timestamp with time zone
) language plpgsql security definer 
set search_path = public, auth
as $$
declare
    v_user_role text;
begin
    -- Verificamos el rol de quien llama
    select a.role into v_user_role 
    from public.admins a 
    where a.user_id = auth.uid();

    if v_user_role is null or v_user_role != 'superadmin' then
        raise exception 'Acceso denegado. Rol actual: %', coalesce(v_user_role, 'NADA');
    end if;

    return query
    select 
        a.user_id as id,
        coalesce(u.email::text, 'UID no encontrado') as email,
        a.role as role,
        a.created_at as created_at
    from public.admins a
    left join auth.users u on a.user_id = u.id
    order by a.created_at desc;
end;
$$;

-- 3. Reset MFA (2FA) for a user
create or replace function public.reset_admin_mfa(p_user_id uuid)
returns void language plpgsql security definer 
set search_path = public, auth
as $$
begin
    if not exists (select 1 from public.admins where user_id = auth.uid() and role = 'superadmin') then
        raise exception 'Acceso denegado.';
    end if;

    delete from auth.mfa_factors where user_id = p_user_id;
end;
$$;

-- 4. Update Admin Role
create or replace function public.update_admin_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer 
set search_path = public, auth
as $$
begin
    if not exists (select 1 from public.admins where user_id = auth.uid() and role = 'superadmin') then
        raise exception 'Acceso denegado.';
    end if;

    update public.admins set role = p_role where user_id = p_user_id;
end;
$$;

-- 5. PERMISSIONS
grant execute on function public.get_admin_users to authenticated;
grant execute on function public.reset_admin_mfa to authenticated;
grant execute on function public.update_admin_role to authenticated;

-- 🔒 MASTER ROLE FIX (Run this part only if you are locked out)
-- update public.admins set role = 'superadmin' where user_id = auth.uid();