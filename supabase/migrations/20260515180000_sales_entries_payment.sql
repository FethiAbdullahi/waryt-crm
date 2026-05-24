-- Payment / collection fields for sales log and quick add (credit, cash, cheque).

alter table public.sales_entries
  add column if not exists sale_collection_type text,
  add column if not exists payment_method text,
  add column if not exists payment_due_date date,
  add column if not exists credit_term_days integer,
  add column if not exists credit_collected_at timestamptz,
  add column if not exists credit_notes text;

update public.sales_entries
set sale_collection_type = coalesce(sale_collection_type, 'full_amount');

update public.sales_entries
set payment_method = coalesce(payment_method, 'cash');

alter table public.sales_entries alter column sale_collection_type set default 'full_amount';
alter table public.sales_entries alter column payment_method set default 'cash';

alter table public.sales_entries alter column sale_collection_type set not null;
alter table public.sales_entries alter column payment_method set not null;

alter table public.sales_entries drop constraint if exists sales_entries_sale_collection_type_chk;
alter table public.sales_entries
  add constraint sales_entries_sale_collection_type_chk check (sale_collection_type in ('full_amount', 'credit'));

alter table public.sales_entries drop constraint if exists sales_entries_payment_method_chk;
alter table public.sales_entries
  add constraint sales_entries_payment_method_chk check (payment_method in ('credit', 'cash', 'cheque'));

alter table public.sales_entries drop constraint if exists sales_entries_collection_payment_chk;
alter table public.sales_entries
  add constraint sales_entries_collection_payment_chk check (
    (sale_collection_type = 'full_amount' and payment_method in ('cash', 'cheque'))
    or (sale_collection_type = 'credit' and payment_method = 'credit')
  );

alter table public.sales_entries drop constraint if exists sales_entries_credit_due_chk;
alter table public.sales_entries
  add constraint sales_entries_credit_due_chk check (
    sale_collection_type <> 'credit'
    or payment_due_date is not null
  );

alter table public.sales_entries drop constraint if exists sales_entries_full_no_due_chk;
alter table public.sales_entries
  add constraint sales_entries_full_no_due_chk check (
    sale_collection_type <> 'full_amount'
    or payment_due_date is null
  );

create index if not exists sales_entries_payment_method_idx on public.sales_entries (payment_method);

create index if not exists sales_entries_credit_open_due_idx on public.sales_entries (payment_due_date)
  where sale_collection_type = 'credit' and credit_collected_at is null;
