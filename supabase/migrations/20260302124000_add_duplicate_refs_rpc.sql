
-- 🔍 RPC: Obtener Referencias Duplicadas 🔍
-- Esta función identifica pagos que comparten el mismo número de referencia.

create or replace function public.get_duplicate_references()
returns table (
  reference text,
  occurrence_count bigint,
  latest_user text,
  raffle_titles text[]
) language plpgsql security definer as $$
begin
  -- Verificar permisos
  if public.get_my_role() is null then
    raise exception 'Acceso denegado.';
  end if;

  return query
  with duplicates as (
    select pr.reference
    from public.purchase_requests pr
    where pr.reference is not null 
      and pr.reference != '' 
      and pr.reference != 'S/N'
      and pr.reference != '0000' -- Excluir refs genéricas si existen
    group by pr.reference
    having count(*) > 1
  )
  select 
    d.reference,
    count(pr.id) as occurrence_count,
    max(pr.full_name) as latest_user, -- Muestra un nombre de referencia
    array_agg(distinct r.title) as raffle_titles
  from duplicates d
  join public.purchase_requests pr on pr.reference = d.reference
  join public.raffles r on pr.raffle_id = r.id
  group by d.reference;
end;
$$;

grant execute on function public.get_duplicate_references to authenticated, service_role;
