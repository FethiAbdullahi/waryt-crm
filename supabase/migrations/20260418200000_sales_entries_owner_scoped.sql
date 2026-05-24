-- Owner-scoped sales: nullable team_id, optional pipeline prospect link, RLS + RPC updates.

-- ---------------------------------------------------------------------------
-- sales_entries schema
-- ---------------------------------------------------------------------------
alter table public.sales_entries alter column team_id drop not null;

alter table public.sales_entries
  add column if not exists prospect_id uuid references public.studio_prospects (id) on delete set null;

create index if not exists sales_entries_prospect_id_idx on public.sales_entries (prospect_id);

-- ---------------------------------------------------------------------------
-- RLS: sales_entries
-- ---------------------------------------------------------------------------
drop policy if exists sales_select on public.sales_entries;
create policy sales_select on public.sales_entries for select using (
  user_id = auth.uid()
  or public.is_admin()
  or (team_id is not null and public.is_manager_of_team(team_id))
  or (team_id is null and public.my_role() = 'manager'::public.user_role)
);

drop policy if exists sales_insert on public.sales_entries;
create policy sales_insert on public.sales_entries for insert with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and (
      team_id is null
      or team_id in (select public.my_team_ids())
    )
    and (
      prospect_id is null
      or exists (
        select 1
        from public.studio_prospects sp
        where sp.id = prospect_id
          and (sp.owner_id = user_id or public.is_admin())
      )
    )
  )
  or (
    team_id is not null
    and public.is_manager_of_team(team_id)
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = team_id
        and tm.user_id = user_id
    )
  )
);

drop policy if exists sales_update on public.sales_entries;
create policy sales_update on public.sales_entries for update using (
  public.is_admin()
  or user_id = auth.uid()
  or (team_id is not null and public.is_manager_of_team(team_id))
  or (team_id is null and public.my_role() = 'manager'::public.user_role)
);

drop policy if exists sales_delete on public.sales_entries;
create policy sales_delete on public.sales_entries for delete using (
  public.is_admin()
  or user_id = auth.uid()
  or (team_id is not null and public.is_manager_of_team(team_id))
  or (team_id is null and public.my_role() = 'manager'::public.user_role)
);

-- ---------------------------------------------------------------------------
-- RPC: personal totals (ignore team — owner account aggregates all of their rows)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_my_sales_summary(p_team_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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

  select coalesce(sum(amount), 0) into today_amt
  from public.sales_entries
  where user_id = uid and sale_date = d0;

  select coalesce(sum(amount), 0) into week_amt
  from public.sales_entries
  where user_id = uid and sale_date between w_start and d0;

  select coalesce(sum(amount), 0) into month_amt
  from public.sales_entries
  where user_id = uid and sale_date between m_start and m_end;

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
-- RPC: org-wide week leaderboard (managers / admins; no team filter)
-- ---------------------------------------------------------------------------
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
    where public.is_admin() or public.my_role() = 'manager'::public.user_role
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

revoke all on function public.rpc_org_week_leaderboard(date, date, int) from public;
grant execute on function public.rpc_org_week_leaderboard(date, date, int) to authenticated;

-- ---------------------------------------------------------------------------
-- search_crm: managers can find sales with null team_id
-- ---------------------------------------------------------------------------
create or replace function public.search_crm(q text, p_limit int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw text := trim(coalesce(q, ''));
  lim int := greatest(1, least(coalesce(p_limit, 20), 50));
  needle text;
  out jsonb;
begin
  if raw = '' or auth.uid() is null then
    return '[]'::jsonb;
  end if;

  needle := '%' || raw || '%';

  select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb)
  into out
  from (
    select *
    from (
      select 'team' as type, t.id::text as id, t.name as title, null::text as subtitle
      from public.teams t
      where (public.is_admin() or t.id in (select public.my_team_ids()))
        and t.name ilike needle
      union all
      select 'profile' as type, p.id::text as id, p.display_name as title, null::text as subtitle
      from public.profiles p
      where (
        public.is_admin()
        or public.shares_team_with(p.id)
        or p.id = auth.uid()
      )
      and p.display_name ilike needle
      union all
      select 'sale' as type, s.id::text as id,
        ('$' || s.amount::text) as title,
        coalesce(s.customer_name, '') as subtitle
      from public.sales_entries s
      where (
        s.user_id = auth.uid()
        or public.is_admin()
        or public.is_manager_of_team(s.team_id)
        or (s.team_id is null and public.my_role() = 'manager'::public.user_role)
      )
      and (
        coalesce(s.customer_name, '') ilike needle
        or coalesce(s.notes, '') ilike needle
      )
    ) q
    order by q.type, q.title
    limit lim
  ) u;

  return coalesce(out, '[]'::jsonb);
end;
$$;

revoke all on function public.search_crm(text, int) from public;
grant execute on function public.search_crm(text, int) to authenticated;
