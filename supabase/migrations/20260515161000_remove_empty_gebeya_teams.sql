-- Remove empty legacy Gebeya-named teams (no members, no sales, no prospect tags, no team targets).
-- Renaming is handled by 20260515140000_rename_gebeya_teams_to_waryt.sql; this cleans orphan rows.

delete from public.teams t
where (t.name ilike '%gebeya%')
  and not exists (select 1 from public.team_members m where m.team_id = t.id)
  and not exists (select 1 from public.sales_entries se where se.team_id = t.id)
  and not exists (select 1 from public.studio_prospects sp where sp.team_id = t.id)
  and not exists (select 1 from public.targets tg where tg.team_id = t.id);

-- Any remaining "Gebeya" in display name → Waryt (case-insensitive).
update public.teams
set name = regexp_replace(name, 'gebeya', 'Waryt', 'gi')
where name ~* 'gebeya';
