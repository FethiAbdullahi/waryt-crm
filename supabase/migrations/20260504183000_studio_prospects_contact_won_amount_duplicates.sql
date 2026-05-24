-- Contact fields, optional won-deal amount (stored USD), duplicate lookup RPC, trigger updates

alter table public.studio_prospects
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists closed_deal_amount numeric(14, 2);

alter table public.studio_prospects
  drop constraint if exists studio_prospects_closed_deal_amount_chk;

alter table public.studio_prospects
  add constraint studio_prospects_closed_deal_amount_chk check (
    closed_deal_amount is null or closed_deal_amount >= 0
  );

create or replace function public.studio_prospect_stage_won_ts()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.stage = 'won' then
      new.closed_deal_at := coalesce(new.closed_deal_at, now());
    else
      new.closed_deal_at := null;
      new.closed_deal_amount := null;
    end if;
  else
    if new.stage = 'won' and old.stage is distinct from 'won' then
      new.closed_deal_at := coalesce(new.closed_deal_at, now());
    elsif new.stage is distinct from 'won' then
      new.closed_deal_at := null;
      new.closed_deal_amount := null;
    end if;
  end if;
  return new;
end;
$$;

-- Org-wide duplicate lookup (bypasses RLS) for add/edit lead UX
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
  where length(trim(p_name)) >= 2
    and lower(regexp_replace(trim(sp.business_name), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'))
    and (p_exclude_id is null or sp.id <> p_exclude_id)
  order by sp.updated_at desc
  limit 24;
$$;

alter function public.studio_pipeline_business_name_duplicates(text, uuid) owner to postgres;

grant execute on function public.studio_pipeline_business_name_duplicates(text, uuid) to authenticated;
