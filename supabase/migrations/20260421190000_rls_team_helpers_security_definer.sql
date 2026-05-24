-- Fix "stack depth limit exceeded" on studio_prospects, profiles, team_members, reports, etc.
-- Cause: team_members_select uses `team_id in (select public.my_team_ids())`, and my_team_ids()
--        SELECTs team_members under invoker → RLS re-enters team_members_select → infinite recursion.
-- Fix: read team_members (and related checks) inside SECURITY DEFINER helpers.

create or replace function public.my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.team_id
  from public.team_members tm
  where tm.user_id = auth.uid();
$$;

create or replace function public.is_manager_of_team(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = tid
      and tm.user_id = auth.uid()
      and tm.member_role = 'manager'::public.member_role
  )
  or public.is_admin();
$$;

create or replace function public.shares_team_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members a
    join public.team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid()
      and b.user_id = target_user
  );
$$;

grant execute on function public.my_team_ids() to authenticated;
grant execute on function public.is_manager_of_team(uuid) to authenticated;
grant execute on function public.shares_team_with(uuid) to authenticated;
