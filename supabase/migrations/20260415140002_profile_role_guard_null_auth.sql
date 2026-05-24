-- If 20260415140001 failed on the profile UPDATE (no JWT in SQL editor / migrations),
-- apply this migration alone or after 40001.

create or replace function public.prevent_non_admin_role_change()
returns trigger language plpgsql as $$
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

update public.profiles p
set role = 'super_admin'::public.user_role
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('fethi.abdullahi@gebeya.com');
