-- Dala Hub CRM: schema, RLS, realtime, RPCs
-- Run via Supabase CLI or SQL editor

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'manager', 'agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('manager', 'agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.target_scope as enum ('user', 'team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.target_period as enum ('daily', 'weekly', 'monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.challenge_status as enum ('draft', 'active', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.challenge_metric as enum ('total_sales_amount');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role public.user_role not null default 'agent',
  avatar_url text,
  notification_prefs jsonb not null default '{"sales": true, "challenges": true, "digest": true}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists teams_name_idx on public.teams (lower(name));

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role public.member_role not null default 'agent',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create unique index if not exists team_members_one_primary_per_user
  on public.team_members (user_id)
  where is_primary;

create index if not exists team_members_team_idx on public.team_members (team_id);
create index if not exists team_members_user_idx on public.team_members (user_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists products_active_sort_idx on public.products (active, sort_order);

create table if not exists public.sales_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  product_id uuid references public.products (id) on delete set null,
  amount numeric(14, 2) not null check (amount >= 0),
  customer_name text,
  notes text,
  sale_date date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_entries_team_sale_date_idx on public.sales_entries (team_id, sale_date desc);
create index if not exists sales_entries_user_sale_date_idx on public.sales_entries (user_id, sale_date desc);
create index if not exists sales_entries_created_at_id_idx on public.sales_entries (created_at desc, id desc);

create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  scope public.target_scope not null,
  user_id uuid references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  period public.target_period not null,
  starts_on date not null,
  ends_on date not null,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (
    (scope = 'user' and user_id is not null and team_id is null)
    or (scope = 'team' and team_id is not null and user_id is null)
  )
);

create index if not exists targets_user_period_idx on public.targets (user_id, starts_on, ends_on);
create index if not exists targets_team_period_idx on public.targets (team_id, starts_on, ends_on);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  metric public.challenge_metric not null default 'total_sales_amount',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  status public.challenge_status not null default 'draft',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists challenges_status_ends_idx on public.challenges (status, ends_at desc);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  score numeric(14, 2) not null default 0,
  primary key (challenge_id, user_id)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text,
  icon text not null default 'award',
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sales_entries_set_updated_at on public.sales_entries;
create trigger sales_entries_set_updated_at
  before update on public.sales_entries
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'agent'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_non_admin_role_change()
returns trigger language plpgsql as $$
declare
  me public.user_role;
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    select role into me from public.profiles where id = auth.uid();
    if me is distinct from 'admin'::public.user_role then
      raise exception 'Only admins can change roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.prevent_non_admin_role_change();

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY INVOKER)
-- ---------------------------------------------------------------------------
create or replace function public.my_role()
returns public.user_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.my_team_ids()
returns setof uuid
language sql
stable
as $$
  select team_id from public.team_members where user_id = auth.uid();
$$;

create or replace function public.is_manager_of_team(tid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = tid
      and tm.user_id = auth.uid()
      and tm.member_role = 'manager'
  ) or public.is_admin();
$$;

create or replace function public.shares_team_with(target_user uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.team_members a
    join public.team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = target_user
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: leaderboard for a team (top N by period)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_team_leaderboard(
  p_team_id uuid,
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
    where
      public.is_admin()
      or exists (select 1 from public.team_members tm where tm.team_id = p_team_id and tm.user_id = auth.uid())
  ),
  agg as (
    select
      se.user_id,
      sum(se.amount)::numeric as total_amount
    from public.sales_entries se
    where se.team_id = p_team_id
      and se.sale_date between p_from and p_to
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
  limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.rpc_team_leaderboard(uuid, date, date, int) from public;
grant execute on function public.rpc_team_leaderboard(uuid, date, date, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: my sales totals (day / week / month windows)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_my_sales_summary(
  p_team_id uuid default null
)
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
  team_filter uuid;
  today_amt numeric;
  week_amt numeric;
  month_amt numeric;
begin
  if uid is null then
    return '{}'::jsonb;
  end if;

  team_filter := coalesce(p_team_id, (
    select tm.team_id from public.team_members tm
    where tm.user_id = uid and tm.is_primary
    limit 1
  ));

  select coalesce(sum(amount), 0) into today_amt
  from public.sales_entries
  where user_id = uid and sale_date = d0
    and (team_filter is null or team_id = team_filter);

  select coalesce(sum(amount), 0) into week_amt
  from public.sales_entries
  where user_id = uid and sale_date between w_start and d0
    and (team_filter is null or team_id = team_filter);

  select coalesce(sum(amount), 0) into month_amt
  from public.sales_entries
  where user_id = uid and sale_date between m_start and m_end
    and (team_filter is null or team_id = team_filter);

  return jsonb_build_object(
    'today', today_amt,
    'week', week_amt,
    'month', month_amt,
    'team_id', team_filter
  );
end;
$$;

revoke all on function public.rpc_my_sales_summary(uuid) from public;
grant execute on function public.rpc_my_sales_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: search (simple ILIKE across entities)
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

-- ---------------------------------------------------------------------------
-- RPC: challenge leaderboard
-- ---------------------------------------------------------------------------
create or replace function public.rpc_challenge_leaderboard(p_challenge_id uuid)
returns table (
  user_id uuid,
  display_name text,
  score numeric,
  rank int
)
language sql
stable
security definer
set search_path = public
as $$
  with ch as (
    select * from public.challenges c where c.id = p_challenge_id
  ),
  allowed as (
    select 1
    from ch
    where
      public.is_admin()
      or exists (
        select 1 from public.challenge_participants cp
        where cp.challenge_id = ch.id and cp.user_id = auth.uid()
      )
      or exists (
        select 1 from public.challenges c2
        join public.profiles p on p.id = auth.uid()
        where c2.id = p_challenge_id and p.role in ('admin', 'manager')
      )
  ),
  scores as (
    select
      cp.user_id,
      cp.score as score
    from public.challenge_participants cp
    where cp.challenge_id = p_challenge_id
  ),
  ranked as (
    select
      s.user_id,
      pr.display_name,
      s.score,
      row_number() over (order by s.score desc) as rank
    from scores s
    join public.profiles pr on pr.id = s.user_id
  )
  select r.user_id, r.display_name, r.score, r.rank::int
  from ranked r
  cross join allowed al
  where al is not null
  order by r.rank
  limit 100;
$$;

revoke all on function public.rpc_challenge_leaderboard(uuid) from public;
grant execute on function public.rpc_challenge_leaderboard(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Recompute challenge scores (sales in window)
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
  if not (public.is_admin() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'
  )) then
    raise exception 'not allowed';
  end if;

  update public.challenge_participants cp
  set score = coalesce((
    select sum(se.amount)
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.products enable row level security;
alter table public.sales_entries enable row level security;
alter table public.targets enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.notifications enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or public.shares_team_with(id)
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update using (public.is_admin());

-- teams
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select using (
  public.is_admin()
  or id in (select public.my_team_ids())
);

drop policy if exists teams_write_admin on public.teams;
drop policy if exists teams_insert_manager on public.teams;
create policy teams_write_admin on public.teams for insert with check (public.is_admin());
create policy teams_insert_manager on public.teams for insert with check (
  public.my_role() = 'manager'::public.user_role
);

drop policy if exists teams_update_admin_manager on public.teams;
create policy teams_update_admin_manager on public.teams for update using (
  public.is_admin() or public.is_manager_of_team(id)
);

drop policy if exists teams_delete_admin on public.teams;
create policy teams_delete_admin on public.teams for delete using (public.is_admin());

-- team_members
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select using (
  public.is_admin()
  or team_id in (select public.my_team_ids())
);

drop policy if exists team_members_write on public.team_members;
create policy team_members_write on public.team_members for insert with check (
  public.is_admin() or public.is_manager_of_team(team_id)
);

drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members for update using (
  public.is_admin() or public.is_manager_of_team(team_id)
);

drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members for delete using (
  public.is_admin() or public.is_manager_of_team(team_id)
);

-- products
drop policy if exists products_select on public.products;
create policy products_select on public.products for select using (auth.role() = 'authenticated');

drop policy if exists products_write_admin on public.products;
create policy products_write_admin on public.products for insert with check (public.is_admin());

drop policy if exists products_update_admin on public.products;
create policy products_update_admin on public.products for update using (public.is_admin());

drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin on public.products for delete using (public.is_admin());

-- sales_entries
drop policy if exists sales_select on public.sales_entries;
create policy sales_select on public.sales_entries for select using (
  user_id = auth.uid()
  or public.is_admin()
  or public.is_manager_of_team(team_id)
);

drop policy if exists sales_insert on public.sales_entries;
create policy sales_insert on public.sales_entries for insert with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and team_id in (select public.my_team_ids())
  )
  or (
    public.is_manager_of_team(team_id)
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
  or public.is_manager_of_team(team_id)
);

drop policy if exists sales_delete on public.sales_entries;
create policy sales_delete on public.sales_entries for delete using (
  public.is_admin()
  or user_id = auth.uid()
  or public.is_manager_of_team(team_id)
);

-- targets
drop policy if exists targets_select on public.targets;
create policy targets_select on public.targets for select using (
  public.is_admin()
  or (scope = 'user' and user_id = auth.uid())
  or (scope = 'team' and team_id in (select public.my_team_ids()))
);

drop policy if exists targets_write_admin_manager on public.targets;
create policy targets_write_admin_manager on public.targets for insert with check (
  public.is_admin()
  or (
    public.my_role() = 'manager'::public.user_role
    and scope = 'team'
    and public.is_manager_of_team(team_id)
  )
  or (
    public.my_role() = 'manager'::public.user_role
    and scope = 'user'
    and public.shares_team_with(user_id)
  )
);

drop policy if exists targets_insert_self on public.targets;
create policy targets_insert_self on public.targets for insert with check (
  scope = 'user'::public.target_scope
  and user_id = auth.uid()
);

drop policy if exists targets_update_admin_manager on public.targets;
create policy targets_update_admin_manager on public.targets for update using (
  public.is_admin()
  or (
    public.my_role() = 'manager'::public.user_role
    and scope = 'team'
    and public.is_manager_of_team(team_id)
  )
  or (
    public.my_role() = 'manager'::public.user_role
    and scope = 'user'
    and public.shares_team_with(user_id)
  )
);

drop policy if exists targets_delete_admin_manager on public.targets;
create policy targets_delete_admin_manager on public.targets for delete using (
  public.is_admin()
  or (
    public.my_role() = 'manager'::public.user_role
    and scope = 'team'
    and public.is_manager_of_team(team_id)
  )
  or (
    public.my_role() = 'manager'::public.user_role
    and scope = 'user'
    and public.shares_team_with(user_id)
  )
);

-- challenges
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select using (
  public.is_admin()
  or public.my_role() in ('manager'::public.user_role, 'agent'::public.user_role)
);

drop policy if exists challenges_write_mgr_admin on public.challenges;
create policy challenges_write_mgr_admin on public.challenges for insert with check (
  public.is_admin() or public.my_role() = 'manager'::public.user_role
);

drop policy if exists challenges_update_mgr_admin on public.challenges;
create policy challenges_update_mgr_admin on public.challenges for update using (
  public.is_admin() or public.my_role() = 'manager'::public.user_role
);

drop policy if exists challenges_delete_mgr_admin on public.challenges;
create policy challenges_delete_mgr_admin on public.challenges for delete using (
  public.is_admin() or public.my_role() = 'manager'::public.user_role
);

-- challenge_participants
drop policy if exists cp_select on public.challenge_participants;
create policy cp_select on public.challenge_participants for select using (
  public.is_admin()
  or user_id = auth.uid()
  or public.my_role() in ('manager'::public.user_role, 'admin'::public.user_role)
);

drop policy if exists cp_insert on public.challenge_participants;
create policy cp_insert on public.challenge_participants for insert with check (
  user_id = auth.uid()
  or public.is_admin()
  or public.my_role() = 'manager'::public.user_role
);

drop policy if exists cp_update on public.challenge_participants;
create policy cp_update on public.challenge_participants for update using (
  public.is_admin() or public.my_role() = 'manager'::public.user_role
);

drop policy if exists cp_delete on public.challenge_participants;
create policy cp_delete on public.challenge_participants for delete using (
  public.is_admin() or public.my_role() = 'manager'::public.user_role
);

-- badges
drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges for select using (auth.role() = 'authenticated');

drop policy if exists badges_insert_admin on public.badges;
create policy badges_insert_admin on public.badges for insert with check (public.is_admin());

drop policy if exists badges_update_admin on public.badges;
create policy badges_update_admin on public.badges for update using (public.is_admin());

drop policy if exists badges_delete_admin on public.badges;
create policy badges_delete_admin on public.badges for delete using (public.is_admin());

-- user_badges
drop policy if exists ub_select on public.user_badges;
create policy ub_select on public.user_badges for select using (
  user_id = auth.uid()
  or public.is_admin()
  or public.shares_team_with(user_id)
);

drop policy if exists ub_write on public.user_badges;
create policy ub_write on public.user_badges for insert with check (public.is_admin() or public.my_role() = 'manager'::public.user_role);

drop policy if exists ub_delete on public.user_badges;
create policy ub_delete on public.user_badges for delete using (public.is_admin() or public.my_role() = 'manager'::public.user_role);

-- notifications
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select using (user_id = auth.uid());

drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update using (user_id = auth.uid());

drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert with check (
  public.is_admin() or public.my_role() = 'manager'::public.user_role
);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.sales_entries;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Seed reference data (no auth users required)
-- ---------------------------------------------------------------------------
-- Default seed teams removed — create teams from Admin → Teams as needed.

insert into public.products (id, name, active, sort_order)
values
  ('22222222-2222-2222-2222-222222222201', 'Training', true, 10),
  ('22222222-2222-2222-2222-222222222202', 'Placement', true, 20),
  ('22222222-2222-2222-2222-222222222203', 'Subscription', true, 30),
  ('22222222-2222-2222-2222-222222222204', 'Consulting', true, 40),
  ('22222222-2222-2222-2222-222222222205', 'Other', true, 100)
on conflict (id) do nothing;

insert into public.badges (id, slug, label, description, icon)
values
  ('33333333-3333-3333-3333-333333333301', 'top_seller', 'Top Seller', 'Ranked #1 for the period', 'trophy'),
  ('33333333-3333-3333-3333-333333333302', 'fast_closer', 'Fast Closer', '3+ deals in a day', 'zap'),
  ('33333333-3333-3333-3333-333333333303', 'streak_7', 'On Fire', '7-day sales streak', 'flame')
on conflict (slug) do nothing;
