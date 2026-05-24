"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Star, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormatMoney } from "@/lib/display-currency-store";
import { currentQuarterUtcRange } from "@/lib/studio-dates";
import type { SatisfactionSummaryRow } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

type LeaderRow = {
  user_id: string;
  display_name: string;
  total_amount: number | string;
  rank: number;
};

export function AdminOrgPerformanceClient() {
  const { money } = useFormatMoney();
  const tSat = useTranslations("satisfaction");
  const { fromIso, toIso } = currentQuarterUtcRange();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const { data: quarterSum = 0 } = useQuery({
    queryKey: ["admin", "quarter-sum", fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_sales_sum_for_range", {
        p_from: fromDate,
        p_to: toDate,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ["admin", "org-performance-quarter", fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_org_week_leaderboard", {
        p_from: fromDate,
        p_to: toDate,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as LeaderRow[];
    },
  });

  const { data: satisfactionSummary = [] } = useQuery({
    queryKey: ["satisfaction", "admin-summary", fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_satisfaction_summary_for_range", {
        p_from: fromDate,
        p_to: toDate,
      });
      if (error) throw error;
      return (data ?? []) as SatisfactionSummaryRow[];
    },
  });

  const satisfactionByUser = useMemo(() => {
    const m = new Map<string, { avg: number; count: number }>();
    for (const r of satisfactionSummary) {
      m.set(r.user_id, { avg: Number(r.avg_rating), count: Number(r.review_count) });
    }
    return m;
  }, [satisfactionSummary]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-xl")}>
          <ArrowLeft className="mr-1 size-4" aria-hidden />
          Admin home
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-foreground text-3xl font-bold tracking-tight">Team performance</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Organization-wide sales totals for the current UTC quarter ({fromDate} → {toDate}), ranked like Waryt
          Studio performance. Same leaderboard RPC used across the app — everyone you can see as admin is
          included.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary rounded-lg p-2">
                <TrendingUp className="size-5" aria-hidden />
              </span>
              <CardTitle className="text-lg">Quarter volume (org)</CardTitle>
            </div>
            <CardDescription>Sum of ranked sellers below (same window as the table).</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-3xl font-bold tabular-nums">{money(quarterSum)}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Targets are per rep in Settings (dated ranges that overlap this quarter roll up here); this card is
              organization revenue from the sales log for the same window.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Window</CardTitle>
            <CardDescription>Calendar quarter in UTC (matches Waryt Studio analytics).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Start:</span>{" "}
              <span className="font-mono text-foreground">{fromDate}</span>
            </p>
            <p>
              <span className="text-muted-foreground">End:</span>{" "}
              <span className="font-mono text-foreground">{toDate}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Sellers ranked by logged sale amount in this quarter.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sales in this quarter yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">{tSat("adminSatisfaction")}</TableHead>
                    <TableHead className="text-right">{tSat("adminReviews")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((r) => {
                    const sat = satisfactionByUser.get(r.user_id);
                    return (
                    <TableRow key={r.user_id}>
                      <TableCell className="text-muted-foreground font-mono text-sm">{r.rank}</TableCell>
                      <TableCell className="font-medium">{r.display_name}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money(Number(r.total_amount))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {sat && sat.count > 0 ? (
                          <span className="inline-flex items-center justify-end gap-1 font-medium text-amber-600 dark:text-amber-400">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                            {sat.avg.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">{tSat("noReviewsYet")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                        {sat && sat.count > 0 ? tSat("reviewCount", { count: sat.count }) : "—"}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
