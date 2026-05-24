-- Customer satisfaction reviews after a deal is closed

create table if not exists public.customer_satisfaction_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  sale_id uuid references public.sales_entries (id) on delete set null,
  prospect_id uuid references public.studio_prospects (id) on delete set null,
  customer_name text not null,
  created_at timestamptz not null default now(),
  constraint csat_link_chk check (sale_id is not null or prospect_id is not null)
);

create index if not exists csat_user_created_idx
  on public.customer_satisfaction_reviews (user_id, created_at desc);

create index if not exists csat_created_date_idx
  on public.customer_satisfaction_reviews ((cast(timezone('utc', created_at) as date)));

alter table public.customer_satisfaction_reviews enable row level security;

drop policy if exists csat_select on public.customer_satisfaction_reviews;
create policy csat_select on public.customer_satisfaction_reviews for select using (
  user_id = auth.uid()
  or public.is_admin()
  or public.my_role() = 'manager'::public.user_role
);

drop policy if exists csat_insert on public.customer_satisfaction_reviews;
create policy csat_insert on public.customer_satisfaction_reviews for insert with check (
  user_id = auth.uid()
);

-- Aggregated satisfaction by seller for a date range (leaderboard / admin)
create or replace function public.rpc_satisfaction_summary_for_range(p_from date, p_to date)
returns table (
  user_id uuid,
  avg_rating numeric,
  review_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.user_id,
    round(avg(r.rating)::numeric, 2) as avg_rating,
    count(*)::bigint as review_count
  from public.customer_satisfaction_reviews r
  where (timezone('utc', r.created_at))::date between p_from and p_to
    and (
      public.is_admin()
      or public.my_role() = 'manager'::public.user_role
      or public.my_role() = 'agent'::public.user_role
    )
  group by r.user_id;
$$;

alter function public.rpc_satisfaction_summary_for_range(date, date) owner to postgres;
revoke all on function public.rpc_satisfaction_summary_for_range(date, date) from public;
grant execute on function public.rpc_satisfaction_summary_for_range(date, date) to authenticated;
