-- Leads are owned by the signed-in rep; team_id is optional (no org team required).

alter table public.studio_prospects
  alter column team_id drop not null;

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

-- Activities: manager access follows prospect owner membership (works when team_id is null).
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
