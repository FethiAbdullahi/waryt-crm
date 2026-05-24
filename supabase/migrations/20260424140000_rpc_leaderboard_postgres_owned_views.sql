-- Leaderboard still showed only "you": RLS on sales_entries uses auth.uid(), which does NOT
-- switch to the definer inside SECURITY DEFINER — only disabling RLS or acting as table owner
-- avoids it. SET row_security can be unreliable depending on PG/Supabase.
--
-- Postgres-owned views with security_invoker = false apply underlying access checks as the
-- view owner (postgres), so scans bypass RLS. Views are NOT granted to anon/authenticated —
-- only this RPC (SECURITY DEFINER, owner postgres) reads them.

create or replace view public.leaderboard_internal_sales
with (security_invoker = false) as
select user_id, sale_date, amount
from public.sales_entries;

create or replace view public.leaderboard_internal_profiles
with (security_invoker = false) as
select id, display_name
from public.profiles;

alter view public.leaderboard_internal_sales owner to postgres;
alter view public.leaderboard_internal_profiles owner to postgres;

revoke all on public.leaderboard_internal_sales from public;
revoke all on public.leaderboard_internal_profiles from public;
revoke all on public.leaderboard_internal_sales from authenticated;
revoke all on public.leaderboard_internal_sales from anon;
revoke all on public.leaderboard_internal_profiles from authenticated;
revoke all on public.leaderboard_internal_profiles from anon;

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
      s.user_id,
      sum(s.amount)::numeric as total_amount
    from public.leaderboard_internal_sales s
    where s.sale_date between p_from and p_to
    group by s.user_id
  ),
  ranked as (
    select
      a.user_id,
      p.display_name,
      a.total_amount,
      row_number() over (order by a.total_amount desc) as rank
    from agg a
    join public.leaderboard_internal_profiles p on p.id = a.user_id
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
