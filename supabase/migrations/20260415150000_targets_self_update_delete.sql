-- Let users fix their own personal targets (insert was already allowed via targets_insert_self).

drop policy if exists targets_update_self on public.targets;
create policy targets_update_self on public.targets
for update
using (scope = 'user'::public.target_scope and user_id = auth.uid())
with check (scope = 'user'::public.target_scope and user_id = auth.uid());

drop policy if exists targets_delete_self on public.targets;
create policy targets_delete_self on public.targets
for delete
using (scope = 'user'::public.target_scope and user_id = auth.uid());
