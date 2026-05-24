-- Allow any trimmed industry / sector label (pipeline + sales), not only the preset enum list.

alter table public.studio_prospects
  drop constraint if exists studio_prospects_industry_chk;

alter table public.studio_prospects
  add constraint studio_prospects_industry_len_chk
  check (char_length(trim(industry)) >= 1 and char_length(trim(industry)) <= 120);

alter table public.sales_entries
  drop constraint if exists sales_entries_industry_chk;

alter table public.sales_entries
  add constraint sales_entries_industry_len_chk
  check (char_length(trim(industry)) >= 1 and char_length(trim(industry)) <= 120);
