-- Dala Studio: B2B prospect pipeline, activities, insights, alerts (RLS + realtime)

-- ---------------------------------------------------------------------------
-- studio_prospects: leads / accounts owned by reps (team_id optional)
-- ---------------------------------------------------------------------------
create table if not exists public.studio_prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  business_name text not null,
  contact_name text,
  industry text not null,
  company_size_band text not null default '1-10',
  stage text not null default 'new',
  account_status text not null default 'active_prospect',
  interested_modules text,
  pain_points text,
  pricing_notes text,
  mrr_monthly numeric(14, 2) not null default 0 check (mrr_monthly >= 0),
  closed_deal_at timestamptz,
  renewal_on date,
  credit_expires_on date,
  needs_cs_attention boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_prospects_industry_chk check (
    industry in (
      'SMEs',
      'Marketing agencies',
      'Schools',
      'NGOs',
      'E-commerce',
      'Retail',
      'Other'
    )
  ),
  constraint studio_prospects_size_chk check (
    company_size_band in ('1-10', '11-25', '26-50')
  ),
  constraint studio_prospects_stage_chk check (
    stage in ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost')
  ),
  constraint studio_prospects_status_chk check (
    account_status in (
      'active_prospect',
      'paying',
      'non_paying',
      'expired',
      'churned'
    )
  )
);

create index if not exists studio_prospects_owner_idx on public.studio_prospects (owner_id);
create index if not exists studio_prospects_team_idx on public.studio_prospects (team_id);
create index if not exists studio_prospects_stage_idx on public.studio_prospects (stage);
create index if not exists studio_prospects_industry_idx on public.studio_prospects (industry);
create index if not exists studio_prospects_closed_idx on public.studio_prospects (closed_deal_at desc);

drop trigger if exists studio_prospects_set_updated_at on public.studio_prospects;
create trigger studio_prospects_set_updated_at
  before update on public.studio_prospects
  for each row execute function public.set_updated_at();

create or replace function public.studio_prospect_stage_won_ts()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.stage = 'won' then
      new.closed_deal_at := coalesce(new.closed_deal_at, now());
    end if;
  else
    if new.stage = 'won' and old.stage is distinct from 'won' then
      new.closed_deal_at := coalesce(new.closed_deal_at, now());
    elsif new.stage is distinct from 'won' then
      new.closed_deal_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists studio_prospects_stage_won on public.studio_prospects;
create trigger studio_prospects_stage_won
  before insert or update on public.studio_prospects
  for each row execute function public.studio_prospect_stage_won_ts();

-- ---------------------------------------------------------------------------
-- studio_activities: conversations / touchpoints on a prospect
-- ---------------------------------------------------------------------------
create table if not exists public.studio_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.studio_prospects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null default 'note',
  body text not null,
  created_at timestamptz not null default now(),
  constraint studio_activities_channel_chk check (
    channel in ('note', 'call', 'email', 'meeting')
  )
);

create index if not exists studio_activities_prospect_idx on public.studio_activities (prospect_id, created_at desc);
create index if not exists studio_activities_user_idx on public.studio_activities (user_id);

-- ---------------------------------------------------------------------------
-- studio_insights: objections, requests, wins, peer-shared patterns
-- ---------------------------------------------------------------------------
create table if not exists public.studio_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  title text not null,
  body text,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  constraint studio_insights_category_chk check (
    category in ('objection', 'feature_request', 'demo_win', 'peer_share')
  )
);

create index if not exists studio_insights_user_idx on public.studio_insights (user_id, created_at desc);
create index if not exists studio_insights_shared_idx on public.studio_insights (is_shared, created_at desc);

-- ---------------------------------------------------------------------------
-- studio_alerts: follow-ups, renewals, CS flags
-- ---------------------------------------------------------------------------
create table if not exists public.studio_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  prospect_id uuid references public.studio_prospects (id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  due_on date not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint studio_alerts_kind_chk check (
    kind in (
      'payment_followup',
      'renewal',
      'credit_expiry',
      'cs_escalation',
      'custom'
    )
  )
);

create index if not exists studio_alerts_user_due_idx on public.studio_alerts (user_id, due_on);
create index if not exists studio_alerts_unresolved_idx on public.studio_alerts (user_id) where resolved_at is null;

-- ---------------------------------------------------------------------------
-- RLS: prospects (owner, manager of same team, admin)
-- ---------------------------------------------------------------------------
alter table public.studio_prospects enable row level security;

drop policy if exists studio_prospects_select on public.studio_prospects;
create policy studio_prospects_select on public.studio_prospects
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.team_members tm
      join public.team_members tm_own on tm_own.team_id = tm.team_id
      where tm.user_id = auth.uid()
        and tm.member_role = 'manager'::public.member_role
        and tm_own.user_id = studio_prospects.owner_id
    )
  );

drop policy if exists studio_prospects_insert on public.studio_prospects;
create policy studio_prospects_insert on public.studio_prospects
  for insert with check (
    public.is_admin()
    or owner_id = auth.uid()
  );

drop policy if exists studio_prospects_update on public.studio_prospects;
create policy studio_prospects_update on public.studio_prospects
  for update using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.team_members tm
      join public.team_members tm_own on tm_own.team_id = tm.team_id
      where tm.user_id = auth.uid()
        and tm.member_role = 'manager'::public.member_role
        and tm_own.user_id = studio_prospects.owner_id
    )
  )
  with check (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.team_members tm
      join public.team_members tm_own on tm_own.team_id = tm.team_id
      where tm.user_id = auth.uid()
        and tm.member_role = 'manager'::public.member_role
        and tm_own.user_id = studio_prospects.owner_id
    )
  );

drop policy if exists studio_prospects_delete on public.studio_prospects;
create policy studio_prospects_delete on public.studio_prospects
  for delete using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.team_members tm
      join public.team_members tm_own on tm_own.team_id = tm.team_id
      where tm.user_id = auth.uid()
        and tm.member_role = 'manager'::public.member_role
        and tm_own.user_id = studio_prospects.owner_id
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: activities
-- ---------------------------------------------------------------------------
alter table public.studio_activities enable row level security;

drop policy if exists studio_activities_select on public.studio_activities;
create policy studio_activities_select on public.studio_activities
  for select using (
    exists (
      select 1 from public.studio_prospects p
      where p.id = studio_activities.prospect_id
        and (
          p.owner_id = auth.uid()
          or public.is_admin()
          or exists (
            select 1
            from public.team_members tm
            join public.team_members tm_own on tm_own.team_id = tm.team_id
            where tm.user_id = auth.uid()
              and tm.member_role = 'manager'::public.member_role
              and tm_own.user_id = p.owner_id
          )
        )
    )
  );

drop policy if exists studio_activities_insert on public.studio_activities;
create policy studio_activities_insert on public.studio_activities
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.studio_prospects p
      where p.id = studio_activities.prospect_id
        and (
          p.owner_id = auth.uid()
          or public.is_admin()
          or exists (
            select 1
            from public.team_members tm
            join public.team_members tm_own on tm_own.team_id = tm.team_id
            where tm.user_id = auth.uid()
              and tm.member_role = 'manager'::public.member_role
              and tm_own.user_id = p.owner_id
          )
        )
    )
  );

drop policy if exists studio_activities_update on public.studio_activities;
create policy studio_activities_update on public.studio_activities
  for update using (
    user_id = auth.uid()
    and exists (
      select 1 from public.studio_prospects p
      where p.id = studio_activities.prospect_id
        and (
          p.owner_id = auth.uid()
          or public.is_admin()
          or exists (
            select 1
            from public.team_members tm
            join public.team_members tm_own on tm_own.team_id = tm.team_id
            where tm.user_id = auth.uid()
              and tm.member_role = 'manager'::public.member_role
              and tm_own.user_id = p.owner_id
          )
        )
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.studio_prospects p
      where p.id = studio_activities.prospect_id
        and (
          p.owner_id = auth.uid()
          or public.is_admin()
          or exists (
            select 1
            from public.team_members tm
            join public.team_members tm_own on tm_own.team_id = tm.team_id
            where tm.user_id = auth.uid()
              and tm.member_role = 'manager'::public.member_role
              and tm_own.user_id = p.owner_id
          )
        )
    )
  );

drop policy if exists studio_activities_delete on public.studio_activities;
create policy studio_activities_delete on public.studio_activities
  for delete using (
    user_id = auth.uid()
    and exists (
      select 1 from public.studio_prospects p
      where p.id = studio_activities.prospect_id
        and (
          p.owner_id = auth.uid()
          or public.is_admin()
          or exists (
            select 1
            from public.team_members tm
            join public.team_members tm_own on tm_own.team_id = tm.team_id
            where tm.user_id = auth.uid()
              and tm.member_role = 'manager'::public.member_role
              and tm_own.user_id = p.owner_id
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: insights
-- ---------------------------------------------------------------------------
alter table public.studio_insights enable row level security;

drop policy if exists studio_insights_select on public.studio_insights;
create policy studio_insights_select on public.studio_insights
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      is_shared
      and public.shares_team_with(studio_insights.user_id)
    )
  );

drop policy if exists studio_insights_insert on public.studio_insights;
create policy studio_insights_insert on public.studio_insights
  for insert with check (user_id = auth.uid());

drop policy if exists studio_insights_update on public.studio_insights;
create policy studio_insights_update on public.studio_insights
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists studio_insights_delete on public.studio_insights;
create policy studio_insights_delete on public.studio_insights
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: alerts
-- ---------------------------------------------------------------------------
alter table public.studio_alerts enable row level security;

drop policy if exists studio_alerts_select on public.studio_alerts;
create policy studio_alerts_select on public.studio_alerts
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists studio_alerts_insert on public.studio_alerts;
create policy studio_alerts_insert on public.studio_alerts
  for insert with check (user_id = auth.uid() or public.is_admin());

drop policy if exists studio_alerts_update on public.studio_alerts;
create policy studio_alerts_update on public.studio_alerts
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists studio_alerts_delete on public.studio_alerts;
create policy studio_alerts_delete on public.studio_alerts
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.studio_prospects to authenticated;
grant select, insert, update, delete on public.studio_activities to authenticated;
grant select, insert, update, delete on public.studio_insights to authenticated;
grant select, insert, update, delete on public.studio_alerts to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (optional; mirrors existing CRM tables)
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.studio_prospects;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.studio_activities;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.studio_insights;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.studio_alerts;
exception when duplicate_object then null;
end $$;
