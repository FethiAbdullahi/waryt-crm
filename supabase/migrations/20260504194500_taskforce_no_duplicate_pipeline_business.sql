-- Taskforce (agent): block new/renamed leads when normalized business_name already exists org-wide.
-- Also widen duplicate RPC to match single-character names (same as trigger normalization).

create or replace function public.studio_pipeline_business_name_duplicates(
  p_name text,
  p_exclude_id uuid default null
)
returns table (
  prospect_id uuid,
  owner_id uuid,
  business_name text,
  owner_display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.id,
    sp.owner_id,
    sp.business_name,
    coalesce(nullif(trim(pr.display_name), ''), sp.owner_id::text) as owner_display_name
  from public.studio_prospects sp
  left join public.profiles pr on pr.id = sp.owner_id
  where length(trim(p_name)) >= 1
    and lower(regexp_replace(trim(sp.business_name), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'))
    and (p_exclude_id is null or sp.id <> p_exclude_id)
  order by sp.updated_at desc
  limit 24;
$$;

alter function public.studio_pipeline_business_name_duplicates(text, uuid) owner to postgres;

create or replace function public.studio_prospects_enforce_agent_unique_business_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
  norm_new text;
begin
  if tg_op = 'UPDATE' then
    if lower(regexp_replace(trim(old.business_name), '\s+', ' ', 'g')) is not distinct from
       lower(regexp_replace(trim(new.business_name), '\s+', ' ', 'g')) then
      return new;
    end if;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  select p.role into actor_role from public.profiles p where p.id = auth.uid();
  if actor_role is null or actor_role is distinct from 'agent'::public.user_role then
    return new;
  end if;

  norm_new := lower(regexp_replace(trim(new.business_name), '\s+', ' ', 'g'));
  if length(norm_new) < 1 then
    return new;
  end if;

  if exists (
    select 1
    from public.studio_prospects sp
    where (tg_op = 'INSERT' or sp.id is distinct from new.id)
      and lower(regexp_replace(trim(sp.business_name), '\s+', ' ', 'g')) = norm_new
  ) then
    raise exception 'DUPLICATE_PIPELINE_BUSINESS: A company with this name is already on the pipeline. Taskforce members cannot add duplicate leads.';
  end if;

  return new;
end;
$$;

alter function public.studio_prospects_enforce_agent_unique_business_fn() owner to postgres;

drop trigger if exists studio_prospects_agent_unique_business on public.studio_prospects;
create trigger studio_prospects_agent_unique_business
  before insert or update on public.studio_prospects
  for each row execute function public.studio_prospects_enforce_agent_unique_business_fn();
