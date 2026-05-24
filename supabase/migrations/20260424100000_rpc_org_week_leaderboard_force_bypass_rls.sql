-- Top performers still showed only the caller: set_config(row_security) inside PL/pgSQL can be
-- ineffective if the function owner cannot change that GUC, or PostgREST/plan quirks.
-- Fix: (1) SET row_security = off on the function definition (session for the call, PG15+).
-- (2) OWNER postgres so the definer matches the usual table owner / privileges on Supabase.
--
-- NOTE: LANGUAGE sql here can still be *inlined* so RLS runs as the invoker. Apply
-- 20260424120000_rpc_org_week_leaderboard_plpgsql_no_inline.sql (final plpgsql version).

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
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
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
$$;

alter function public.rpc_org_week_leaderboard(date, date, int) owner to postgres;

revoke all on function public.rpc_org_week_leaderboard(date, date, int) from public;
grant execute on function public.rpc_org_week_leaderboard(date, date, int) to authenticated;
