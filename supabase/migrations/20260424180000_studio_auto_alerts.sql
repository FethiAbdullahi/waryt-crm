-- Auto studio_alerts: credit/renewal windows, non-paying, CS flag.
-- source = 'auto' vs manual; partial unique index dedupes open auto rows.
-- Daily pg_cron (when available) + trigger on prospect changes + rpc_auto_studio_alerts_for_me().

alter table public.studio_alerts
  add column if not exists source text not null default 'manual';

update public.studio_alerts set source = 'manual' where source is null;

do $chk$
begin
  alter table public.studio_alerts drop constraint if exists studio_alerts_source_chk;
  alter table public.studio_alerts
    add constraint studio_alerts_source_chk check (source in ('manual', 'auto'));
exception
  when duplicate_object then null;
end;
$chk$;

create unique index if not exists studio_alerts_auto_open_dedupe_idx
  on public.studio_alerts (user_id, prospect_id, kind)
  where resolved_at is null and source = 'auto';

-- Core: resolve stale auto rows, then insert missing auto rows (scoped by owner / prospect).
create or replace function public.rpc_auto_studio_alerts_run_internal(
  p_horizon_days int,
  p_owner_id uuid,
  p_prospect_id uuid
)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  h int := greatest(1, least(coalesce(p_horizon_days, 45), 365));
begin
  update public.studio_alerts a
  set resolved_at = now()
  from public.studio_prospects p
  where a.source = 'auto'
    and a.resolved_at is null
    and a.prospect_id = p.id
    and (p_prospect_id is null or p.id = p_prospect_id)
    and (p_owner_id is null or p.owner_id = p_owner_id)
    and (
      (a.kind = 'cs_escalation' and coalesce(p.needs_cs_attention, false) = false)
      or (a.kind = 'payment_followup' and p.account_status is distinct from 'non_paying')
      or (
        a.kind = 'credit_expiry'
        and (
          p.credit_expires_on is null
          or p.credit_expires_on > (current_date + h)
        )
      )
      or (
        a.kind = 'renewal'
        and (
          p.renewal_on is null
          or p.renewal_on > (current_date + h)
        )
      )
    );

  insert into public.studio_alerts (user_id, prospect_id, kind, title, body, due_on, source)
  select
    p.owner_id,
    p.id,
    'credit_expiry'::text,
    'Credit expiring — ' || left(p.business_name, 200),
    'Credit expires on ' || p.credit_expires_on::text || '.',
    p.credit_expires_on,
    'auto'
  from public.studio_prospects p
  where p.credit_expires_on is not null
    and p.credit_expires_on >= current_date
    and p.credit_expires_on <= current_date + h
    and (p_prospect_id is null or p.id = p_prospect_id)
    and (p_owner_id is null or p.owner_id = p_owner_id)
    and not exists (
      select 1
      from public.studio_alerts a
      where a.user_id = p.owner_id
        and a.prospect_id = p.id
        and a.kind = 'credit_expiry'
        and a.resolved_at is null
        and a.source = 'auto'
    );

  insert into public.studio_alerts (user_id, prospect_id, kind, title, body, due_on, source)
  select
    p.owner_id,
    p.id,
    'renewal'::text,
    'Renewal — ' || left(p.business_name, 200),
    'Renewal date ' || p.renewal_on::text || '.',
    p.renewal_on,
    'auto'
  from public.studio_prospects p
  where p.renewal_on is not null
    and p.renewal_on >= current_date
    and p.renewal_on <= current_date + h
    and (p_prospect_id is null or p.id = p_prospect_id)
    and (p_owner_id is null or p.owner_id = p_owner_id)
    and not exists (
      select 1
      from public.studio_alerts a
      where a.user_id = p.owner_id
        and a.prospect_id = p.id
        and a.kind = 'renewal'
        and a.resolved_at is null
        and a.source = 'auto'
    );

  insert into public.studio_alerts (user_id, prospect_id, kind, title, body, due_on, source)
  select
    p.owner_id,
    p.id,
    'payment_followup'::text,
    'Payment follow-up — ' || left(p.business_name, 200),
    'Account status is non-paying.',
    current_date,
    'auto'
  from public.studio_prospects p
  where p.account_status = 'non_paying'
    and (p_prospect_id is null or p.id = p_prospect_id)
    and (p_owner_id is null or p.owner_id = p_owner_id)
    and not exists (
      select 1
      from public.studio_alerts a
      where a.user_id = p.owner_id
        and a.prospect_id = p.id
        and a.kind = 'payment_followup'
        and a.resolved_at is null
        and a.source = 'auto'
    );

  insert into public.studio_alerts (user_id, prospect_id, kind, title, body, due_on, source)
  select
    p.owner_id,
    p.id,
    'cs_escalation'::text,
    'CS attention — ' || left(p.business_name, 200),
    'This account is flagged for customer success follow-up.',
    current_date,
    'auto'
  from public.studio_prospects p
  where coalesce(p.needs_cs_attention, false) = true
    and (p_prospect_id is null or p.id = p_prospect_id)
    and (p_owner_id is null or p.owner_id = p_owner_id)
    and not exists (
      select 1
      from public.studio_alerts a
      where a.user_id = p.owner_id
        and a.prospect_id = p.id
        and a.kind = 'cs_escalation'
        and a.resolved_at is null
        and a.source = 'auto'
    );
end;
$$;

alter function public.rpc_auto_studio_alerts_run_internal(int, uuid, uuid) owner to postgres;

revoke all on function public.rpc_auto_studio_alerts_run_internal(int, uuid, uuid) from public;

-- Signed-in rep: sync only their pipeline.
create or replace function public.rpc_auto_studio_alerts_for_me(p_horizon_days int default 45)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  perform public.rpc_auto_studio_alerts_run_internal(
    p_horizon_days,
    auth.uid(),
    null
  );
end;
$$;

alter function public.rpc_auto_studio_alerts_for_me(int) owner to postgres;

revoke all on function public.rpc_auto_studio_alerts_for_me(int) from public;
grant execute on function public.rpc_auto_studio_alerts_for_me(int) to authenticated;

-- Cron / superuser path: full org scan (auth.uid() null) or admin.
create or replace function public.rpc_auto_studio_alerts_cron()
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Use rpc_auto_studio_alerts_for_me when signed in';
  end if;
  perform public.rpc_auto_studio_alerts_run_internal(45, null, null);
end;
$$;

alter function public.rpc_auto_studio_alerts_cron() owner to postgres;

revoke all on function public.rpc_auto_studio_alerts_cron() from public;
grant execute on function public.rpc_auto_studio_alerts_cron() to service_role;

-- Immediate sync when key prospect fields change.
create or replace function public.trg_studio_prospects_auto_alerts_fn()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  perform public.rpc_auto_studio_alerts_run_internal(45, null, new.id);
  return new;
end;
$$;

alter function public.trg_studio_prospects_auto_alerts_fn() owner to postgres;

drop trigger if exists studio_prospects_auto_alerts on public.studio_prospects;
create trigger studio_prospects_auto_alerts
  after insert or update of renewal_on, credit_expires_on, account_status, needs_cs_attention, owner_id
  on public.studio_prospects
  for each row
  execute function public.trg_studio_prospects_auto_alerts_fn();

-- pg_cron daily (06:30 UTC). Skip silently if pg_cron is not installed on this instance.
do $cron$
begin
  perform cron.unschedule('studio-auto-alerts-daily');
exception
  when undefined_function then null;
  when undefined_table then null;
  when others then null;
end;
$cron$;

do $cron$
begin
  perform cron.schedule(
    'studio-auto-alerts-daily',
    '30 6 * * *',
    'select public.rpc_auto_studio_alerts_cron();'
  );
exception
  when undefined_function then null;
  when undefined_table then null;
  when others then null;
end;
$cron$;
