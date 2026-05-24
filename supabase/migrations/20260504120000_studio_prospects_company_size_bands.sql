-- Align studio_prospects.company_size_band with app / lib/sales-studio/routes.ts
alter table public.studio_prospects
  drop constraint if exists studio_prospects_size_chk;

alter table public.studio_prospects
  add constraint studio_prospects_size_chk check (
    company_size_band in (
      '1-10',
      '11-25',
      '26-50',
      '51-100',
      '101-500',
      '501-1000',
      '1000+'
    )
  );
