-- Close agent-wide leak on active challenges; scope reads to creator + org admins.
-- Align leaderboard RPC and score refresh with the same visibility model.

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
      or ch.created_by = auth.uid()
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

drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select using (
  public.is_admin()
  or created_by = auth.uid()
);

drop policy if exists cp_select on public.challenge_participants;
create policy cp_select on public.challenge_participants for select using (
  public.is_admin()
  or user_id = auth.uid()
);
