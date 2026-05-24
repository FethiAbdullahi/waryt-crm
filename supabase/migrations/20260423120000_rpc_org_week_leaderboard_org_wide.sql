-- Org-wide weekly leaderboard for all authenticated reps (admin / manager / agent).
-- Previously agents only saw their own sales in the aggregate; everyone now sees the same top board.
-- Note: SQL-only SECURITY DEFINER still applies RLS using the caller's auth.uid(); apply
-- 20260423140000_rpc_org_week_leaderboard_bypass_rls.sql so the aggregate actually sees all rows.

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
set search_path = public
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
