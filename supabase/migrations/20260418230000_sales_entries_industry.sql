-- Dala subscription is one offering; segment sales by customer industry (same list as studio_prospects).

alter table public.sales_entries
  add column if not exists industry text;

update public.sales_entries
set industry = 'Other'
where industry is null;

alter table public.sales_entries
  alter column industry set not null;

alter table public.sales_entries
  drop constraint if exists sales_entries_industry_chk;

alter table public.sales_entries
  add constraint sales_entries_industry_chk check (
    industry in (
      'SMEs',
      'Marketing agencies',
      'Schools',
      'NGOs',
      'E-commerce',
      'Retail',
      'Other'
    )
  );

create index if not exists sales_entries_industry_idx on public.sales_entries (industry);

alter table public.sales_entries drop constraint if exists sales_entries_product_id_fkey;
alter table public.sales_entries drop column if exists product_id;
