-- Simple SQL SECURITY DEFINER functions can be *inlined* into the caller's query. Then the
-- sales_entries scan runs as the invoker (JWT) and RLS still filters to auth.uid() — you only
-- ever see yourself on the leaderboard. PL/pgSQL is not inlined that way; keep SET row_security
-- off on the function for the aggregation.
--
-- If you still only see yourself after this, apply
-- 20260424140000_rpc_leaderboard_postgres_owned_views.sql (RLS-safe bypass via postgres-owned
-- security_invoker=false views).

create or replace function public.rpc_org_week_leaderboard(
  p_from date,
  p_to date,
  p_limit int default 5
)
returns table (
  user_id uuid,
  display_name text,
  total_amount numeric,
  rank int
)
language plpgsql
stable
security definer
set search_path to public
set row_security to off
as $$
begin
  return query
  with allowed as (
    select 1
    where public.is_admin()
      or public.my_role() = 'manager'::public.user_role
      or public.my_role() = 'agent'::public.user_role
  ),
  agg as (
    select
      se.user_id,
      sum(se.amount)::numeric as total_amount
    from public.sales_entries se
    where se.sale_date between p_from and p_to
    group by se.user_id
  ),
  ranked as (
    select
      a.user_id,
      p.display_name,
      a.total_amount,
      row_number() over (order by a.total_amount desc) as rank
    from agg a
    join public.profiles p on p.id = a.user_id
  )
  select r.user_id, r.display_name, r.total_amount, r.rank::int
  from ranked r
  cross join allowed al
  where al is not null
  order by r.rank
  limit greatest(1, least(coalesce(p_limit, 5), 50));
end;
$$;

alter function public.rpc_org_week_leaderboard(date, date, int) owner to postgres;

revoke all on function public.rpc_org_week_leaderboard(date, date, int) from public;
grant execute on function public.rpc_org_week_leaderboard(date, date, int) to authenticated;
