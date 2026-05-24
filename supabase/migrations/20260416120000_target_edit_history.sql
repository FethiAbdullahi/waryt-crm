-- Append-only audit of target field changes (trigger); readable by anyone who can read the target row.

create table if not exists public.target_edit_history (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.targets (id) on delete cascade,
  edited_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  previous jsonb not null,
  next jsonb not null
);

create index if not exists target_edit_history_target_created_idx
  on public.target_edit_history (target_id, created_at desc);

alter table public.target_edit_history enable row level security;

drop policy if exists target_edit_history_select on public.target_edit_history;
create policy target_edit_history_select on public.target_edit_history
for select using (
  exists (
    select 1
    from public.targets t
    where t.id = target_edit_history.target_id
      and (
        public.is_admin()
        or (t.scope = 'user'::public.target_scope and t.user_id = auth.uid())
        or (t.scope = 'team'::public.target_scope and t.team_id in (select public.my_team_ids()))
      )
  )
);

-- Inserts only from trigger (security definer); no direct client insert policy.

create or replace function public.targets_log_edit_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if
    old.amount is not distinct from new.amount
    and old.period is not distinct from new.period
    and old.starts_on is not distinct from new.starts_on
    and old.ends_on is not distinct from new.ends_on
  then
    return new;
  end if;

  insert into public.target_edit_history (target_id, edited_by, previous, next)
  values (
    old.id,
    auth.uid(),
    jsonb_build_object(
      'amount', old.amount,
      'period', old.period,
      'starts_on', old.starts_on,
      'ends_on', old.ends_on
    ),
    jsonb_build_object(
      'amount', new.amount,
      'period', new.period,
      'starts_on', new.starts_on,
      'ends_on', new.ends_on
    )
  );

  return new;
end;
$$;

drop trigger if exists targets_log_edit_history_trg on public.targets;
create trigger targets_log_edit_history_trg
  after update on public.targets
  for each row execute function public.targets_log_edit_history();
