-- Taskforce: agents create their own challenges, scoped visibility, leaderboard for creators.
-- Apply with Supabase CLI (`supabase db push`) or paste into the SQL editor on your project.

-- Leaderboard RPC: allow challenge creators (and existing admin / manager / participant paths).
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
      or ch.created_by = auth.uid()
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
  or (
    public.my_role() = 'agent'::public.user_role
    and created_by = auth.uid()
  )
);

drop policy if exists challenges_update_mgr_admin on public.challenges;
create policy challenges_update_mgr_admin on public.challenges for update using (
  public.can_manage_challenges()
  or (
    public.my_role() = 'agent'::public.user_role
    and created_by = auth.uid()
  )
);

drop policy if exists challenges_delete_mgr_admin on public.challenges;
create policy challenges_delete_mgr_admin on public.challenges for delete using (
  public.can_manage_challenges()
  or (
    public.my_role() = 'agent'::public.user_role
    and created_by = auth.uid()
  )
);

drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select using (
  public.is_admin()
  or public.can_manage_challenges()
  or (
    public.my_role() = 'agent'::public.user_role
    and (
      created_by = auth.uid()
      or exists (
        select 1 from public.challenge_participants cp
        where cp.challenge_id = challenges.id
          and cp.user_id = auth.uid()
      )
      -- Published runs anyone can open to join; drafts stay with the creator (above).
      or status = 'active'::public.challenge_status
    )
  )
);
