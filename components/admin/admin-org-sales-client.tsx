"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminProspectDetailDialog } from "@/components/admin/admin-prospect-detail-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocale } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormatMoney } from "@/lib/display-currency-store";
import { formatSaleForDisplayPreference } from "@/lib/format";
import { saleAmountAsUsdForStats, storedUsdToEntryAmount } from "@/lib/sales-amount-entry";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();
const PAGE_SIZE = 20;

type Rel<T> = T | T[] | null | undefined;

type Row = {
  id: string;
  user_id: string;
  amount: number;
  amount_currency?: string | null;
  industry: string;
  customer_name: string | null;
  notes: string | null;
  sale_date: string;
  created_at: string;
  prospect_id: string | null;
  studio_prospects?: Rel<{ business_name?: string | null }>;
  profiles?: Rel<{ display_name?: string | null }>;
};

function relOne<T>(rel: Rel<T>): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function businessLabel(r: Row): string {
  const b = relOne(r.studio_prospects)?.business_name;
  if (b?.trim()) return b.trim();
  return r.customer_name?.trim() || "—";
}

export function AdminOrgSalesClient() {
  const { money, currency } = useFormatMoney();
  const locale = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["admin", "org-sales", from, to, page],
    queryFn: async () => {
      let q = supabase
        .from("sales_entries")
        .select(
          "id,user_id,amount,amount_currency,industry,customer_name,notes,sale_date,created_at,prospect_id,studio_prospects(business_name),profiles(display_name)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Row[], count: count ?? 0 };
    },
  });

  const rows = useMemo(() => pageData?.rows ?? [], [pageData]);
  const total = pageData?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageSum = useMemo(
    () => rows.reduce((a, r) => a + saleAmountAsUsdForStats(Number(r.amount ?? 0), r.amount_currency), 0),
    [rows],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-xl")}>
          <ArrowLeft className="mr-1 size-4" aria-hidden />
          Admin home
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-foreground text-3xl font-bold tracking-tight">Organization sales</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Every logged sale from all taskforce and managers (same data as the live org total on Admin home).
          Filter by sale date, open a linked pipeline account for full prospect details.
        </p>
      </header>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Sale date is the business day stored on each entry (UTC).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="adm-from">From</Label>
            <Input
              id="adm-from"
              type="date"
              className="w-44 rounded-xl"
              value={from}
              onChange={(e) => {
                setPage(0);
                setFrom(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-to">To</Label>
            <Input
              id="adm-to"
              type="date"
              className="w-44 rounded-xl"
              value={to}
              onChange={(e) => {
                setPage(0);
                setTo(e.target.value);
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setFrom("");
                setTo("");
                setPage(0);
              }}
            >
              Clear dates
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Sales log</CardTitle>
            <CardDescription>
              {total} entr{total === 1 ? "y" : "ies"}
              {rows.length ? ` · ${money(storedUsdToEntryAmount(pageSum, currency))} on this page` : null}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sales in this range.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const seller = relOne(r.profiles)?.display_name ?? r.user_id.slice(0, 8) + "…";
                    const biz = businessLabel(r);
                    const canOpen = Boolean(r.prospect_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {r.sale_date ? format(new Date(`${r.sale_date}T12:00:00Z`), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatSaleForDisplayPreference(Number(r.amount), r.amount_currency, currency, locale)}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[10rem] truncate text-sm">{seller}</TableCell>
                        <TableCell className="max-w-[14rem]">
                          {canOpen ? (
                            <button
                              type="button"
                              className="text-left font-medium text-primary underline-offset-4 hover:underline"
                              onClick={() => setDetailId(r.prospect_id)}
                            >
                              {biz}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">{biz}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.industry}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[12rem] truncate text-xs">
                          {r.notes?.trim() || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {pages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                Page {page + 1} of {pages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AdminProspectDetailDialog
        prospectId={detailId}
        open={detailId != null}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      />
    </div>
  );
}
