"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormatMoney } from "@/lib/display-currency-store";
import { formatUsdTotalInDisplayPreference } from "@/lib/format";
import { saleAmountAsUsdForStats } from "@/lib/sales-amount-entry";
import type { Profile } from "@/lib/types";
import { useLocale } from "next-intl";

const supabase = createBrowserSupabaseClient();

export function PeoplePageClient({
  subject,
  viewerId,
}: {
  subject: Profile;
  viewerId: string;
}) {
  const { currency } = useFormatMoney();
  const locale = useLocale();
  const isSelf = subject.id === viewerId;

  const { data: totals } = useQuery({
    queryKey: ["people", subject.id, "totals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_entries")
        .select("amount,amount_currency,sale_date")
        .eq("user_id", subject.id)
        .order("sale_date", { ascending: false })
        .limit(5000);
      if (error) throw error;

      const rows = data ?? [];
      const rowUsd = (r: { amount: number; amount_currency?: string | null }) =>
        saleAmountAsUsdForStats(Number(r.amount), r.amount_currency);
      const total = rows.reduce((a, r) => a + rowUsd(r as { amount: number; amount_currency?: string | null }), 0);
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const ms = monthStart.toISOString().slice(0, 10);

      const month = rows
        .filter((r) => String(r.sale_date) >= ms)
        .reduce((a, r) => a + rowUsd(r as { amount: number; amount_currency?: string | null }), 0);
      const day = rows
        .filter((r) => String(r.sale_date) === today)
        .reduce((a, r) => a + rowUsd(r as { amount: number; amount_currency?: string | null }), 0);

      return { total, month, day, count: rows.length };
    },
  });

  const { data: target } = useQuery({
    queryKey: ["people", subject.id, "target"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("targets")
        .select("*")
        .eq("scope", "user")
        .eq("user_id", subject.id)
        .lte("starts_on", today)
        .gte("ends_on", today)
        .order("amount", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const monthSales = totals?.month ?? 0;
  const goal = target ? Number(target.amount) : null;
  const progress =
    goal && goal > 0 ? Math.min(100, Math.round((monthSales / goal) * 100)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{subject.display_name}</h1>
        <p className="text-muted-foreground text-sm">
          {isSelf ? "Your performance snapshot." : "Team-visible performance snapshot."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border md:col-span-2">
          <CardHeader>
            <CardTitle>Monthly progress</CardTitle>
            <CardDescription>
              {target ? `Target window ${target.starts_on} → ${target.ends_on}` : "No active target"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {progress === null ? (
              <p className="text-muted-foreground text-sm">Set a monthly target to unlock progress.</p>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div className="text-4xl font-semibold tabular-nums">{progress}%</div>
                  <div className="text-muted-foreground text-right text-sm">
                    <div>{formatUsdTotalInDisplayPreference(monthSales, currency, locale)}</div>
                    <div>Goal {formatUsdTotalInDisplayPreference(goal ?? 0, currency, locale)}</div>
                  </div>
                </div>
                <Progress value={progress} className="h-3 rounded-full" />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border">
          <CardHeader>
            <CardTitle>Totals</CardTitle>
            <CardDescription>All-time and recent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Today</span>
              <span className="font-semibold tabular-nums">
                {formatUsdTotalInDisplayPreference(totals?.day ?? 0, currency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">This month</span>
              <span className="font-semibold tabular-nums">
                {formatUsdTotalInDisplayPreference(totals?.month ?? 0, currency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">All time</span>
              <span className="font-semibold tabular-nums">
                {formatUsdTotalInDisplayPreference(totals?.total ?? 0, currency, locale)}
              </span>
            </div>
            <div className="text-muted-foreground pt-2 text-xs">{totals?.count ?? 0} entries</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
