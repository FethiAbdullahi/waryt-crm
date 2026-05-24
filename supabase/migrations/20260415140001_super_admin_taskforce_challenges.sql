-- Depends on 20260415140000_add_user_role_super_admin.sql (enum committed first).

-- Bootstrap + promote super-admin email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  r public.user_role := 'agent';
begin
  if lower(coalesce(new.email, '')) = lower('fethi.abdullahi@gebeya.com') then
    r := 'super_admin';
  end if;
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    r
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Must run before UPDATE below: migrations / SQL editor have no JWT (auth.uid() is null).
create or replace function public.prevent_non_admin_role_change()
returns trigger language plpgsql as $$
declare
  me public.user_role;
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if auth.uid() is null then
      return new;
    end if;
    select role into me from public.profiles where id = auth.uid();
    if me is distinct from 'admin'::public.user_role
       and me is distinct from 'super_admin'::public.user_role then
      raise exception 'Only admins can change roles';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin'::public.user_role, 'super_admin'::public.user_role)
  );
$$;

update public.profiles p
set role = 'super_admin'::public.user_role
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('fethi.abdullahi@gebeya.com');

create or replace function public.can_manage_challenges()
returns boolean
language sql
stable
as $$
  select public.is_admin()
    or public.my_role() = 'manager'::public.user_role
    or exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.member_role = 'manager'::public.member_role
    );
$$;

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
  if not public.can_manage_challenges() then
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
      or public.can_manage_challenges()
      or exists (
        select 1 from public.challenge_participants cp
        where cp.challenge_id = ch.id and cp.user_id = auth.uid()
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

drop policy if exists challenges_write_mgr_admin on public.challenges;
create policy challenges_write_mgr_admin on public.challenges for insert with check (
  public.can_manage_challenges()
);

drop policy if exists challenges_update_mgr_admin on public.challenges;
create policy challenges_update_mgr_admin on public.challenges for update using (
  public.can_manage_challenges()
);

drop policy if exists challenges_delete_mgr_admin on public.challenges;
create policy challenges_delete_mgr_admin on public.challenges for delete using (
  public.can_manage_challenges()
);

drop policy if exists cp_insert on public.challenge_participants;
create policy cp_insert on public.challenge_participants for insert with check (
  user_id = auth.uid()
  or public.is_admin()
  or public.can_manage_challenges()
);

drop policy if exists cp_update on public.challenge_participants;
create policy cp_update on public.challenge_participants for update using (
  public.is_admin() or public.can_manage_challenges()
);

drop policy if exists cp_delete on public.challenge_participants;
create policy cp_delete on public.challenge_participants for delete using (
  public.is_admin() or public.can_manage_challenges()
);

drop policy if exists cp_select on public.challenge_participants;
create policy cp_select on public.challenge_participants for select using (
  public.is_admin()
  or user_id = auth.uid()
  or public.my_role() in ('manager'::public.user_role, 'admin'::public.user_role, 'super_admin'::public.user_role)
  or public.can_manage_challenges()
);

drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select using (
  public.is_admin()
  or public.my_role() in ('manager'::public.user_role, 'agent'::public.user_role)
);

revoke all on function public.refresh_challenge_scores(uuid) from public;
grant execute on function public.refresh_challenge_scores(uuid) to authenticated;

revoke all on function public.rpc_challenge_leaderboard(uuid) from public;
grant execute on function public.rpc_challenge_leaderboard(uuid) to authenticated;
