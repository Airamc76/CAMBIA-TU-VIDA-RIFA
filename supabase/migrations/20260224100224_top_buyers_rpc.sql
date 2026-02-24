create or replace function public.get_top_buyers(p_raffle_id uuid)
returns table (
  rank bigint,
  buyer_id text,
  buyer_name text,
  total_amount numeric,
  tickets_count bigint,
  purchases_count bigint
) language plpgsql security definer
as $$
begin
  return query
  with aggregated as (
    select 
      national_id as agg_buyer_id,
      max(full_name) as agg_buyer_name,
      sum(amount) as agg_total_amount,
      sum(ticket_qty) as agg_tickets_count,
      count(*) as agg_purchases_count
    from public.purchase_requests
    where raffle_id = p_raffle_id and status = 'approved'
    group by national_id
  )
  select 
    row_number() over (order by agg_total_amount desc, agg_tickets_count desc) as rank,
    a.agg_buyer_id as buyer_id,
    a.agg_buyer_name as buyer_name,
    a.agg_total_amount as total_amount,
    a.agg_tickets_count as tickets_count,
    a.agg_purchases_count as purchases_count
  from aggregated a
  order by rank asc
  limit 5;
end;
$$;
