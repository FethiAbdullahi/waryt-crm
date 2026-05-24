-- Fix "stack depth limit exceeded" when inserting studio_prospects (and other flows) as non-admin.
-- Cause: profiles_select references public.is_admin(), and is_admin() SELECTs profiles → infinite RLS recursion.
-- Fix: read profiles inside SECURITY DEFINER helpers (same pattern as handle_new_user / refresh_challenge_scores).
--
-- If you still see stack depth on GET studio_prospects or reports, apply 20260421190000_rls_team_helpers_security_definer.sql
-- (my_team_ids / team_members RLS recursion).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin'::public.user_role, 'super_admin'::public.user_role)
  );
$$;

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.user_role;
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if auth.uid() is null then
      return new;
    end if;
    select role into me from public.profiles where id = auth.uid();
    if me is distinct from 'admin'::public.user_role
       and me is distinct from 'super_admin'::public.user_role then
      raise exception 'Only admins can change roles';
    end if;
  end if;
  return new;
end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_role() to authenticated;
