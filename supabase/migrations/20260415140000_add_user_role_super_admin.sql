-- New enum values cannot be used in the same transaction as ALTER TYPE ADD VALUE.
-- This migration must run alone (committed) before any SQL references 'super_admin'.

do $$ begin
  alter type public.user_role add value 'super_admin';
exception
  when duplicate_object then null;
end $$;
