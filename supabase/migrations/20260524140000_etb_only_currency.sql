-- ETB-only currency: all monetary amounts stored and aggregated in Ethiopian Birr.
-- Legacy USD-normalized pipeline/target values and USD sale rows are converted once.

-- Rate used historically when normalizing to USD (keep aligned with former NEXT_PUBLIC_ETB_PER_USD).
-- Only applied to rows explicitly stored as USD; ETB sale amounts are kept as-is.
do $$
declare
  v_rate constant numeric := 155.0;
begin
  -- Sales log: USD rows → ETB; ETB rows keep numeric amount
  update public.sales_entries
  set amount = round(amount * v_rate, 2),
      amount_currency = 'ETB'
  where amount_currency = 'USD';

  update public.sales_entries
  set amount_currency = 'ETB'
  where amount_currency is distinct from 'ETB';

  -- Pipeline / targets were stored as USD equivalents
  update public.studio_prospects
  set mrr_monthly = round(mrr_monthly * v_rate, 2)
  where mrr_monthly is not null and mrr_monthly <> 0;

  update public.studio_prospects
  set closed_deal_amount = round(closed_deal_amount * v_rate, 2)
  where closed_deal_amount is not null and closed_deal_amount <> 0;

  update public.targets
  set amount = round(amount * v_rate, 2)
  where amount is not null and amount <> 0;
end $$;

alter table public.sales_entries alter column amount_currency set default 'ETB';

alter table public.sales_entries drop constraint if exists sales_entries_amount_currency_chk;
alter table public.sales_entries
  add constraint sales_entries_amount_currency_chk check (amount_currency = 'ETB');

-- Normalize any sale row to ETB (legacy alias kept for existing RPC bodies during rollout)
create or replace function public.sales_entry_amount_etb(p_amount numeric, p_currency text)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(nullif(trim(p_currency), ''), 'ETB') = 'USD' then round(p_amount * 155.0, 2)
    else round(p_amount, 2)
  end;
$$;

create or replace function public.sales_entry_amount_usd(p_amount numeric, p_currency text)
returns numeric
language sql
immutable
as $$
  select public.sales_entry_amount_etb(p_amount, p_currency);
$$;

-- Leaderboard RPC
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
      sum(public.sales_entry_amount_etb(s.amount, s.amount_currency))::numeric as total_amount
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

-- Personal summary RPC
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

  select coalesce(sum(public.sales_entry_amount_etb(se.amount, se.amount_currency)), 0) into today_amt
  from public.sales_entries se
  where se.user_id = uid and se.sale_date = d0;

  select coalesce(sum(public.sales_entry_amount_etb(se.amount, se.amount_currency)), 0) into week_amt
  from public.sales_entries se
  where se.user_id = uid and se.sale_date between w_start and d0;

  select coalesce(sum(public.sales_entry_amount_etb(se.amount, se.amount_currency)), 0) into month_amt
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

-- Admin org totals
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
        (select sum(public.sales_entry_amount_etb(se.amount, se.amount_currency)) from public.sales_entries se),
        0
      ),
      'total_7d',
      coalesce(
        (
          select sum(public.sales_entry_amount_etb(se.amount, se.amount_currency))
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
        select sum(public.sales_entry_amount_etb(se.amount, se.amount_currency))
        from public.sales_entries se
        where se.sale_date between p_from and p_to
      ),
      0::numeric
    )
    else 0::numeric
  end;
$$;

-- Challenge scores
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
    select sum(public.sales_entry_amount_etb(se.amount, se.amount_currency))
    from public.sales_entries se
    where se.user_id = cp.user_id
      and se.created_at >= c.starts_at
      and se.created_at < c.ends_at
  ), 0)
  where cp.challenge_id = p_challenge_id;
end;
$$;
