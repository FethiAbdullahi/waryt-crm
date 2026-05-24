-- Remove legacy seed teams (Gebeya Growth / Gebeya Enterprise → Waryt Growth / Waryt Enterprise).
-- `sales_entries.team_id` is ON DELETE RESTRICT — null it first for any doomed team id.

with doomed as (
  select distinct t.id
  from public.teams t
  where t.id in (
    '11111111-1111-1111-1111-111111111101'::uuid,
    '11111111-1111-1111-1111-111111111102'::uuid
  )
  or lower(regexp_replace(trim(t.name), '\s+', ' ', 'g')) in (
    'gebeya growth',
    'gebeya enterprise',
    'waryt growth',
    'waryt enterprise'
  )
)
update public.sales_entries se
set team_id = null
where se.team_id in (select id from doomed);

with doomed as (
  select distinct t.id
  from public.teams t
  where t.id in (
    '11111111-1111-1111-1111-111111111101'::uuid,
    '11111111-1111-1111-1111-111111111102'::uuid
  )
  or lower(regexp_replace(trim(t.name), '\s+', ' ', 'g')) in (
    'gebeya growth',
    'gebeya enterprise',
    'waryt growth',
    'waryt enterprise'
  )
)
delete from public.teams t
where t.id in (select id from doomed);
