-- Store each sale amount in the currency it was entered in (USD or ETB). Legacy rows stay USD.
-- Aggregations that must compare apples-to-apples use sales_entry_amount_usd() (default rate 155 ETB/USD — keep aligned with NEXT_PUBLIC_ETB_PER_USD in the app).

alter table public.sales_entries
  add column if not exists amount_currency text;

update public.sales_entries
set amount_currency = 'USD'
where amount_currency is null;

alter table public.sales_entries alter column amount_currency set default 'USD';
alter table public.sales_entries alter column amount_currency set not null;

alter table public.sales_entries drop constraint if exists sales_entries_amount_currency_chk;
alter table public.sales_entries
  add constraint sales_entries_amount_currency_chk check (amount_currency in ('USD', 'ETB'));

create or replace function public.sales_entry_amount_usd(p_amount numeric, p_currency text)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(nullif(trim(p_currency), ''), 'USD') = 'ETB' then p_amount / 155.0
    else p_amount
  end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard view + RPC (must match 20260424140000 pattern; add currency column)
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard_internal_sales
with (security_invoker = false) as
select
  user_id,
  sale_date,
  amount,
  amount_currency
from public.sales_entries;

alter view public.leaderboard_internal_sales owner to postgres;

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
      sum(public.sales_entry_amount_usd(s.amount, s.amount_currency))::numeric as total_amount
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

-- ---------------------------------------------------------------------------
-- Personal summary RPC
-- ---------------------------------------------------------------------------
create or replace function public.rpc_my_sales_summary(p_team_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to public
as $$
declare
  uid uuid := auth.uid();
  d0 date := (timezone('utc', now()))::date;
  w_start date := d0 - ((extract(dow from d0)::int + 6) % 7);
  m_start date := date_trunc('month', d0::timestamptz)::date;
  m_end date := (date_trunc('month', d0::timestamptz) + interval '1 month - 1 day')::date;
  today_amt numeric;
  week_amt numeric;
  month_amt numeric;
begin
  if uid is null then
    return '{}'::jsonb;
  end if;

  select coalesce(sum(public.sales_entry_amount_usd(se.amount, se.amount_currency)), 0) into today_amt
  from public.sales_entries se
  where se.user_id = uid and se.sale_date = d0;

  select coalesce(sum(public.sales_entry_amount_usd(se.amount, se.amount_currency)), 0) into week_amt
  from public.sales_entries se
  where se.user_id = uid and se.sale_date between w_start and d0;

  select coalesce(sum(public.sales_entry_amount_usd(se.amount, se.amount_currency)), 0) into month_amt
  from public.sales_entries se
  where se.user_id = uid and se.sale_date between m_start and m_end;

  return jsonb_build_object(
    'today', today_amt,
    'week', week_amt,
    'month', month_amt,
    'team_id', null
  );
end;
$$;

revoke all on function public.rpc_my_sales_summary(uuid) from public;
grant execute on function public.rpc_my_sales_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin org totals
-- ---------------------------------------------------------------------------
create or replace function public.rpc_admin_sales_overview()
returns jsonb
language sql
stable
security definer
set search_path to public
as $$
  select case
    when public.is_admin() then jsonb_build_object(
      'total_all_time',
      coalesce(
        (select sum(public.sales_entry_amount_usd(se.amount, se.amount_currency)) from public.sales_entries se),
        0
      ),
      'total_7d',
      coalesce(
        (
          select sum(public.sales_entry_amount_usd(se.amount, se.amount_currency))
          from public.sales_entries se
          where se.created_at >= (timezone('utc', now()) - interval '7 days')
        ),
        0
      ),
      'entries_7d',
      (
        select count(*)::int
        from public.sales_entries se
        where se.created_at >= (timezone('utc', now()) - interval '7 days')
      ),
      'entries_all_time',
      (select count(*)::int from public.sales_entries se)
    )
    else '{}'::jsonb
  end;
$$;

alter function public.rpc_admin_sales_overview() owner to postgres;

revoke all on function public.rpc_admin_sales_overview() from public;
grant execute on function public.rpc_admin_sales_overview() to authenticated;

create or replace function public.rpc_admin_sales_sum_for_range(p_from date, p_to date)
returns numeric
language sql
stable
security definer
set search_path to public
as $$
  select case
    when public.is_admin() then coalesce(
      (
        select sum(public.sales_entry_amount_usd(se.amount, se.amount_currency))
        from public.sales_entries se
        where se.sale_date between p_from and p_to
      ),
      0::numeric
    )
    else 0::numeric
  end;
$$;

alter function public.rpc_admin_sales_sum_for_range(date, date) owner to postgres;

revoke all on function public.rpc_admin_sales_sum_for_range(date, date) from public;
grant execute on function public.rpc_admin_sales_sum_for_range(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Challenge scores
-- ---------------------------------------------------------------------------
create or replace function public.refresh_challenge_scores(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select * into strict c from public.challenges where id = p_challenge_id;
  if not (
    public.can_manage_challenges()
    or public.is_admin()
    or c.created_by = auth.uid()
  ) then
    raise exception 'not allowed';
  end if;

  update public.challenge_participants cp
  set score = coalesce((
    select sum(public.sales_entry_amount_usd(se.amount, se.amount_currency))
    from public.sales_entries se
    where se.user_id = cp.user_id
      and se.created_at >= c.starts_at
      and se.created_at < c.ends_at
  ), 0)
  where cp.challenge_id = p_challenge_id;
end;
$$;

revoke all on function public.refresh_challenge_scores(uuid) from public;
grant execute on function public.refresh_challenge_scores(uuid) to authenticated;
