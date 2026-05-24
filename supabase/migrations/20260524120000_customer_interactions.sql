-- Customer interaction log, product stock, marketing segments, approval workflow, contact duplicate lookup

-- ---------------------------------------------------------------------------
-- Products: furniture catalog + stock
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists category text,
  add column if not exists stock_quantity numeric(14, 2) not null default 0 check (stock_quantity >= 0),
  add column if not exists is_in_stock boolean not null default true;

create index if not exists products_category_idx on public.products (category) where category is not null;

drop policy if exists products_update_manager on public.products;
create policy products_update_manager on public.products for update using (
  public.is_admin() or public.my_role() = 'manager'::public.user_role
);

-- ---------------------------------------------------------------------------
-- Marketing segments (bulk messaging / categorization)
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general',
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint marketing_segments_name_unique unique (name)
);

create index if not exists marketing_segments_category_idx on public.marketing_segments (category);

insert into public.marketing_segments (name, category, description)
values
  ('Living room', 'furniture_category', 'Interested in living room furniture'),
  ('Bedroom', 'furniture_category', 'Interested in bedroom furniture'),
  ('Office', 'furniture_category', 'Office / workspace furniture'),
  ('Outdoor', 'furniture_category', 'Outdoor furniture'),
  ('B2B corporate', 'customer_type', 'Business / corporate buyer'),
  ('B2C retail', 'customer_type', 'Individual / household buyer'),
  ('Repeat buyer', 'purchase_history', 'Has purchased before'),
  ('High intent', 'purchase_history', 'Strong purchase intent, follow-up priority')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Customer interactions (showroom / field visit log)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  team_id uuid references public.teams (id) on delete set null,
  prospect_id uuid references public.studio_prospects (id) on delete set null,
  interaction_date date not null default (timezone('utc', now()))::date,
  customer_name text not null,
  contact_phone text,
  contact_email text,
  customer_segment text not null default 'b2c',
  made_purchase boolean not null default false,
  primary_product_id uuid references public.products (id) on delete set null,
  primary_product_notes text,
  stock_sufficient boolean,
  internal_notes text,
  feedback_concerns text,
  alternative_offered boolean,
  alternative_description text,
  follow_up_back_in_stock boolean,
  follow_up_product_id uuid references public.products (id) on delete set null,
  follow_up_notes text,
  approval_status text not null default 'submitted',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_interactions_segment_chk check (customer_segment in ('b2b', 'b2c')),
  constraint customer_interactions_approval_chk check (
    approval_status in ('draft', 'submitted', 'approved', 'rejected')
  )
);

create index if not exists customer_interactions_user_date_idx
  on public.customer_interactions (user_id, interaction_date desc);
create index if not exists customer_interactions_approval_idx
  on public.customer_interactions (approval_status, created_at desc);
create index if not exists customer_interactions_prospect_idx
  on public.customer_interactions (prospect_id);
create index if not exists customer_interactions_phone_idx
  on public.customer_interactions (lower(trim(contact_phone)))
  where contact_phone is not null and trim(contact_phone) <> '';
create index if not exists customer_interactions_email_idx
  on public.customer_interactions (lower(trim(contact_email)))
  where contact_email is not null and trim(contact_email) <> '';

drop trigger if exists customer_interactions_set_updated_at on public.customer_interactions;
create trigger customer_interactions_set_updated_at
  before update on public.customer_interactions
  for each row execute function public.set_updated_at();

-- Line items when a purchase was made
create table if not exists public.interaction_purchased_items (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.customer_interactions (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity numeric(14, 2) not null default 1 check (quantity > 0),
  sort_order int not null default 0
);

create index if not exists interaction_purchased_items_interaction_idx
  on public.interaction_purchased_items (interaction_id, sort_order);

-- Segment tags on an interaction (for marketing export)
create table if not exists public.interaction_segment_tags (
  interaction_id uuid not null references public.customer_interactions (id) on delete cascade,
  segment_id uuid not null references public.marketing_segments (id) on delete cascade,
  primary key (interaction_id, segment_id)
);

-- Persistent tags on pipeline accounts
create table if not exists public.prospect_marketing_segments (
  prospect_id uuid not null references public.studio_prospects (id) on delete cascade,
  segment_id uuid not null references public.marketing_segments (id) on delete cascade,
  primary key (prospect_id, segment_id)
);

-- ---------------------------------------------------------------------------
-- Duplicate contact lookup (phone / email across interactions + prospects)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_contact_phone(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(trim(p), ''), '[^0-9+]', '', 'g'), '');
$$;

create or replace function public.interaction_contact_duplicates(
  p_phone text default null,
  p_email text default null,
  p_exclude_interaction_id uuid default null
)
returns table (
  source text,
  record_id uuid,
  customer_name text,
  contact_phone text,
  contact_email text,
  owner_display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  norm_phone text := public.normalize_contact_phone(p_phone);
  norm_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    return;
  end if;

  if norm_phone is not null and norm_phone <> '' then
    return query
    select
      'interaction'::text,
      ci.id,
      ci.customer_name,
      ci.contact_phone,
      ci.contact_email,
      coalesce(p.display_name, ci.user_id::text)
    from public.customer_interactions ci
    join public.profiles p on p.id = ci.user_id
    where public.normalize_contact_phone(ci.contact_phone) = norm_phone
      and (p_exclude_interaction_id is null or ci.id <> p_exclude_interaction_id);

    return query
    select
      'prospect'::text,
      sp.id,
      sp.business_name,
      sp.contact_phone,
      sp.contact_email,
      coalesce(p.display_name, sp.owner_id::text)
    from public.studio_prospects sp
    join public.profiles p on p.id = sp.owner_id
    where public.normalize_contact_phone(sp.contact_phone) = norm_phone;
  end if;

  if norm_email <> '' then
    return query
    select
      'interaction'::text,
      ci.id,
      ci.customer_name,
      ci.contact_phone,
      ci.contact_email,
      coalesce(p.display_name, ci.user_id::text)
    from public.customer_interactions ci
    join public.profiles p on p.id = ci.user_id
    where lower(trim(coalesce(ci.contact_email, ''))) = norm_email
      and (p_exclude_interaction_id is null or ci.id <> p_exclude_interaction_id);

    return query
    select
      'prospect'::text,
      sp.id,
      sp.business_name,
      sp.contact_phone,
      sp.contact_email,
      coalesce(p.display_name, sp.owner_id::text)
    from public.studio_prospects sp
    join public.profiles p on p.id = sp.owner_id
    where lower(trim(coalesce(sp.contact_email, ''))) = norm_email;
  end if;
end;
$$;

alter function public.interaction_contact_duplicates(text, text, uuid) owner to postgres;
grant execute on function public.interaction_contact_duplicates(text, text, uuid) to authenticated;

-- Auto reminder when customer wants back-in-stock notification
create or replace function public.customer_interaction_follow_up_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prod_name text;
begin
  if new.follow_up_back_in_stock is true and (
    tg_op = 'INSERT'
    or coalesce(old.follow_up_back_in_stock, false) is distinct from true
  ) then
    select name into prod_name from public.products where id = new.follow_up_product_id;
    insert into public.studio_alerts (
      user_id,
      prospect_id,
      kind,
      title,
      body,
      due_on,
      source
    )
    values (
      new.user_id,
      new.prospect_id,
      'custom',
      'Back in stock follow-up — ' || left(new.customer_name, 120),
      coalesce(
        'Customer requested notification when '
          || coalesce(prod_name, new.primary_product_notes, 'requested item')
          || ' is available. '
          || coalesce(new.follow_up_notes, ''),
        'Back in stock follow-up requested.'
      ),
      (timezone('utc', now()) + interval '7 days')::date,
      'auto'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists customer_interactions_follow_up_alert on public.customer_interactions;
create trigger customer_interactions_follow_up_alert
  after insert or update of follow_up_back_in_stock, follow_up_product_id, follow_up_notes, customer_name, prospect_id
  on public.customer_interactions
  for each row execute function public.customer_interaction_follow_up_alert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.marketing_segments enable row level security;
alter table public.customer_interactions enable row level security;
alter table public.interaction_purchased_items enable row level security;
alter table public.interaction_segment_tags enable row level security;
alter table public.prospect_marketing_segments enable row level security;

drop policy if exists marketing_segments_select on public.marketing_segments;
create policy marketing_segments_select on public.marketing_segments for select using (
  auth.role() = 'authenticated'
);

drop policy if exists marketing_segments_write_admin on public.marketing_segments;
create policy marketing_segments_write_admin on public.marketing_segments for all using (
  public.is_admin()
) with check (public.is_admin());

drop policy if exists customer_interactions_select on public.customer_interactions;
create policy customer_interactions_select on public.customer_interactions for select using (
  user_id = auth.uid()
  or public.is_admin()
  or public.my_role() = 'manager'::public.user_role
);

drop policy if exists customer_interactions_insert on public.customer_interactions;
create policy customer_interactions_insert on public.customer_interactions for insert with check (
  user_id = auth.uid()
);

drop policy if exists customer_interactions_update on public.customer_interactions;
create policy customer_interactions_update on public.customer_interactions for update using (
  user_id = auth.uid()
  or public.is_admin()
  or public.my_role() = 'manager'::public.user_role
);

drop policy if exists customer_interactions_delete on public.customer_interactions;
create policy customer_interactions_delete on public.customer_interactions for delete using (
  public.is_admin()
  or (user_id = auth.uid() and approval_status in ('draft', 'rejected'))
);

drop policy if exists interaction_items_select on public.interaction_purchased_items;
create policy interaction_items_select on public.interaction_purchased_items for select using (
  exists (
    select 1 from public.customer_interactions ci
    where ci.id = interaction_id
      and (
        ci.user_id = auth.uid()
        or public.is_admin()
        or public.my_role() = 'manager'::public.user_role
      )
  )
);

drop policy if exists interaction_items_write on public.interaction_purchased_items;
create policy interaction_items_write on public.interaction_purchased_items for all using (
  exists (
    select 1 from public.customer_interactions ci
    where ci.id = interaction_id
      and (
        ci.user_id = auth.uid()
        or public.is_admin()
        or public.my_role() = 'manager'::public.user_role
      )
  )
) with check (
  exists (
    select 1 from public.customer_interactions ci
    where ci.id = interaction_id
      and (
        ci.user_id = auth.uid()
        or public.is_admin()
        or public.my_role() = 'manager'::public.user_role
      )
  )
);

drop policy if exists interaction_segment_tags_select on public.interaction_segment_tags;
create policy interaction_segment_tags_select on public.interaction_segment_tags for select using (
  auth.role() = 'authenticated'
);

drop policy if exists interaction_segment_tags_write on public.interaction_segment_tags;
create policy interaction_segment_tags_write on public.interaction_segment_tags for all using (
  exists (
    select 1 from public.customer_interactions ci
    where ci.id = interaction_id
      and (
        ci.user_id = auth.uid()
        or public.is_admin()
        or public.my_role() = 'manager'::public.user_role
      )
  )
) with check (
  exists (
    select 1 from public.customer_interactions ci
    where ci.id = interaction_id
      and (
        ci.user_id = auth.uid()
        or public.is_admin()
        or public.my_role() = 'manager'::public.user_role
      )
  )
);

drop policy if exists prospect_marketing_segments_select on public.prospect_marketing_segments;
create policy prospect_marketing_segments_select on public.prospect_marketing_segments for select using (
  auth.role() = 'authenticated'
);

drop policy if exists prospect_marketing_segments_write on public.prospect_marketing_segments;
create policy prospect_marketing_segments_write on public.prospect_marketing_segments for all using (
  exists (
    select 1 from public.studio_prospects sp
    where sp.id = prospect_id
      and (sp.owner_id = auth.uid() or public.is_admin() or public.my_role() = 'manager'::public.user_role)
  )
) with check (
  exists (
    select 1 from public.studio_prospects sp
    where sp.id = prospect_id
      and (sp.owner_id = auth.uid() or public.is_admin() or public.my_role() = 'manager'::public.user_role)
  )
);

-- Sample furniture catalog (updates legacy seed rows + adds showroom SKUs)
update public.products set name = 'Sofa set', category = 'Living room', stock_quantity = 12, is_in_stock = true, sort_order = 10
where id = '22222222-2222-2222-2222-222222222201';
update public.products set name = 'Dining table', category = 'Dining', stock_quantity = 8, is_in_stock = true, sort_order = 20
where id = '22222222-2222-2222-2222-222222222202';
update public.products set name = 'Bed frame', category = 'Bedroom', stock_quantity = 15, is_in_stock = true, sort_order = 30
where id = '22222222-2222-2222-2222-222222222203';
update public.products set name = 'Office desk', category = 'Office', stock_quantity = 6, is_in_stock = true, sort_order = 40
where id = '22222222-2222-2222-2222-222222222204';
update public.products set name = 'Accent chair', category = 'Living room', stock_quantity = 20, is_in_stock = true, sort_order = 50
where id = '22222222-2222-2222-2222-222222222205';

insert into public.products (name, category, stock_quantity, is_in_stock, active, sort_order)
values
  ('Wardrobe', 'Bedroom', 4, true, true, 60),
  ('Outdoor lounge set', 'Outdoor', 2, false, true, 70);
