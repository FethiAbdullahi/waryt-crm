-- Accurate org-wide sales totals for admins (avoids PostgREST row caps on large selects).

create or replace function public.rpc_admin_sales_overview()
returns jsonb
language sql
stable
security definer
set search_path to public
as $$
  select case
    when public.is_admin() then jsonb_build_object(
      'total_all_time',
      coalesce((select sum(se.amount) from public.sales_entries se), 0),
      'total_7d',
      coalesce(
        (
          select sum(se.amount)
          from public.sales_entries se
          where se.created_at >= (timezone('utc', now()) - interval '7 days')
        ),
        0
      ),
      'entries_7d',
      (
        select count(*)::int
        from public.sales_entries se
        where se.created_at >= (timezone('utc', now()) - interval '7 days')
      ),
      'entries_all_time',
      (select count(*)::int from public.sales_entries se)
    )
    else '{}'::jsonb
  end;
$$;

alter function public.rpc_admin_sales_overview() owner to postgres;

revoke all on function public.rpc_admin_sales_overview() from public;
grant execute on function public.rpc_admin_sales_overview() to authenticated;

-- Sum sales in a sale_date window (admin only) — avoids client row caps.
create or replace function public.rpc_admin_sales_sum_for_range(p_from date, p_to date)
returns numeric
language sql
stable
security definer
set search_path to public
as $$
  select case
    when public.is_admin() then coalesce(
      (select sum(se.amount) from public.sales_entries se where se.sale_date between p_from and p_to),
      0::numeric
    )
    else 0::numeric
  end;
$$;

alter function public.rpc_admin_sales_sum_for_range(date, date) owner to postgres;

revoke all on function public.rpc_admin_sales_sum_for_range(date, date) from public;
grant execute on function public.rpc_admin_sales_sum_for_range(date, date) to authenticated;
