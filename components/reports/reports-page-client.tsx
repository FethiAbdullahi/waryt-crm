"use client";

import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  Activity,
  BarChart3,
  CalendarRange,
  Layers,
  PieChart as PieChartIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { saleAmountAsUsdForStats } from "@/lib/sales-amount-entry";
import { formatCompactNumber, formatUsdTotalInDisplayPreference } from "@/lib/format";
import { isTaskforceMember } from "@/lib/roles";
import type { Profile, UserRole } from "@/lib/types";
import { ContextualHint } from "@/components/onboarding/contextual-hint";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

const supabase = createBrowserSupabaseClient();

type Rel<T> = T | T[] | null | undefined;

type SaleRow = {
  sale_date: string;
  amount: number;
  amount_currency: string;
  team_id: string | null;
  user_id: string;
  industry: string;
  teams?: Rel<{ name: string }>;
  profiles?: Rel<{ display_name: string }>;
};

function relPerson(rel: SaleRow["profiles"]): string {
  if (!rel) return "Member";
  const o = Array.isArray(rel) ? rel[0] : rel;
  return o?.display_name ?? "Member";
}

type FetchMode = "full" | "noIndustry" | "noRelations" | "minimal";

function parseSaleRows(raw: unknown[], mode: FetchMode): SaleRow[] {
  return raw.map((row) => {
    const o = row as Record<string, unknown>;
    const dateKey = String(o.sale_date ?? "").slice(0, 10);
    const industryFromRow =
      mode === "noIndustry" || mode === "minimal"
        ? "Unknown"
        : String(o.industry ?? "").trim() || "Unknown";
    return {
      sale_date: dateKey,
      amount: Number(o.amount),
      amount_currency: "ETB",
      team_id: (o.team_id as string | null) ?? null,
      user_id: o.user_id as string,
      industry: industryFromRow,
      teams:
        mode === "noRelations" || mode === "minimal" ? undefined : (o.teams as SaleRow["teams"]),
      profiles:
        mode === "noRelations" || mode === "minimal" ? undefined : (o.profiles as SaleRow["profiles"]),
    };
  });
}

async function fetchPage(select: string, from: string, to: string, offset: number, pageSize: number) {
  return supabase
    .from("sales_entries")
    .select(select)
    .gte("sale_date", from)
    .lte("sale_date", to)
    .order("sale_date", { ascending: true })
    .range(offset, offset + pageSize - 1);
}

/** Tries progressively simpler selects so analytics still load if `industry` or FK embeds are unavailable. */
async function fetchSalesInDateRange(from: string, to: string): Promise<SaleRow[]> {
  const pageSize = 1000;
  const attempts: Array<{ select: string; mode: FetchMode }> = [
    {
      select: "sale_date,amount,amount_currency,team_id,user_id,industry,teams(name),profiles(display_name)",
      mode: "full",
    },
    {
      select: "sale_date,amount,amount_currency,team_id,user_id,teams(name),profiles(display_name)",
      mode: "noIndustry",
    },
    {
      select: "sale_date,amount,amount_currency,team_id,user_id,industry",
      mode: "noRelations",
    },
    {
      select: "sale_date,amount,amount_currency,team_id,user_id",
      mode: "minimal",
    },
  ];

  let lastError: Error | null = null;

  for (const { select, mode } of attempts) {
    const out: SaleRow[] = [];
    let offset = 0;
    let failed = false;
    for (;;) {
      const { data, error } = await fetchPage(select, from, to, offset, pageSize);
      if (error) {
        lastError = new Error(error.message);
        failed = true;
        break;
      }
      const batch = data ?? [];
      out.push(...parseSaleRows(batch as unknown[], mode));
      if (batch.length < pageSize) break;
      offset += pageSize;
    }
    if (!failed) return out;
  }

  throw lastError ?? new Error("Could not load sales_entries");
}

function sumAmount(rows: SaleRow[]) {
  return rows.reduce((a, r) => a + saleAmountAsUsdForStats(Number(r.amount), r.amount_currency), 0);
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function ReportsPageClient({ profile }: { profile: Profile | null }) {
  const { currency } = useFormatMoney();
  const locale = useLocale();
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);

  const { data: rawRows, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["reports", "analytics", rangeDays],
    queryFn: async () => {
      const end = new Date();
      const endStr = end.toISOString().slice(0, 10);
      const spanStart = subDays(end, rangeDays * 2 - 1);
      const spanStartStr = format(spanStart, "yyyy-MM-dd");
      return fetchSalesInDateRange(spanStartStr, endStr);
    },
  });

  const analytics = useMemo(() => {
    const end = new Date();
    const endStr = end.toISOString().slice(0, 10);
    const currentStart = subDays(end, rangeDays - 1);
    const currentStartStr = format(currentStart, "yyyy-MM-dd");
    const prevEnd = subDays(currentStart, 1);
    const prevEndStr = format(prevEnd, "yyyy-MM-dd");
    const prevStart = subDays(prevEnd, rangeDays - 1);
    const prevStartStr = format(prevStart, "yyyy-MM-dd");

    const rows = rawRows ?? [];
    const inRange = (row: SaleRow, from: string, to: string) => {
      const d = row.sale_date.slice(0, 10);
      return d >= from && d <= to;
    };

    const currentRows = rows.filter((r) => inRange(r, currentStartStr, endStr));
    const previousRows = rows.filter((r) => inRange(r, prevStartStr, prevEndStr));

    const currentTotal = sumAmount(currentRows);
    const previousTotal = sumAmount(previousRows);
    const deltaPct = pctChange(currentTotal, previousTotal);

    const byDay = new Map<string, number>();
    for (const r of currentRows) {
      const d = r.sale_date.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + saleAmountAsUsdForStats(Number(r.amount), r.amount_currency));
    }
    const dailySeries: { day: string; label: string; total: number }[] = [];
    for (let i = 0; i < rangeDays; i += 1) {
      const d = subDays(end, rangeDays - 1 - i);
      const key = format(d, "yyyy-MM-dd");
      dailySeries.push({
        day: format(d, "MMM d"),
        label: key,
        total: byDay.get(key) ?? 0,
      });
    }

    const byIndustry = new Map<string, number>();
    for (const r of currentRows) {
      const label = r.industry?.trim() ? r.industry : "Unknown";
      byIndustry.set(label, (byIndustry.get(label) ?? 0) + saleAmountAsUsdForStats(Number(r.amount), r.amount_currency));
    }
    const industryRows = [...byIndustry.entries()].sort((a, b) => b[1] - a[1]);
    const industryChart = industryRows
      .slice(0, 8)
      .map(([name, total]) => ({ name: name.length > 20 ? `${name.slice(0, 18)}…` : name, total }));
    const pieData = industryRows.slice(0, 5).map(([name, value]) => ({
      name: name.length > 16 ? `${name.slice(0, 14)}…` : name,
      value,
    }));
    const pieOther = industryRows.slice(5).reduce((a, [, v]) => a + v, 0);
    if (pieOther > 0) pieData.push({ name: "Other", value: pieOther });

    const byUser = new Map<string, { name: string; total: number; count: number }>();
    for (const r of currentRows) {
      const name = relPerson(r.profiles);
      const cur = byUser.get(r.user_id) ?? { name, total: 0, count: 0 };
      cur.total += saleAmountAsUsdForStats(Number(r.amount), r.amount_currency);
      cur.count += 1;
      cur.name = name;
      byUser.set(r.user_id, cur);
    }
    const topPeople = [...byUser.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    const userBarChart = [...byUser.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((t) => ({
        name: t.name.length > 22 ? `${t.name.slice(0, 20)}…` : t.name,
        total: t.total,
      }));

    const txCount = currentRows.length;
    const avgDeal = txCount ? currentTotal / txCount : 0;
    const uniqueSellers = new Set(currentRows.map((r) => r.user_id)).size;

    const dow = [0, 0, 0, 0, 0, 0, 0];
    for (const r of currentRows) {
      const wd = new Date(`${r.sale_date.slice(0, 10)}T12:00:00`).getDay();
      dow[wd] += saleAmountAsUsdForStats(Number(r.amount), r.amount_currency);
    }
    const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowSeries = dow.map((total, i) => ({ name: dowLabels[i], total }));

    return {
      currentRows,
      currentTotal,
      previousTotal,
      deltaPct,
      dailySeries,
      userBarChart,
      industryChart,
      pieData,
      topPeople,
      txCount,
      avgDeal,
      uniqueSellers,
      dowSeries,
      windowLabel: `${format(currentStart, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
      compareLabel: `vs prior ${rangeDays} days`,
    };
  }, [rawRows, rangeDays]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & analytics"
        description={
          profile?.display_name
            ? isTaskforceMember((profile.role ?? "agent") as UserRole)
              ? `Hi ${profile.display_name} — your sales in the selected window (same rows as Quick add and Sales log).`
              : `Hi ${profile.display_name} — org-wide sales intelligence for managers and admins. Everything here respects what you can read in Supabase.`
            : isTaskforceMember((profile?.role ?? "agent") as UserRole)
              ? "Your sales in the selected window (same rows as Quick add and Sales log)."
              : "Org-wide sales intelligence for managers and admins. Everything here respects what you can read in Supabase."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
            <CalendarRange className="mr-1.5 inline size-3.5" aria-hidden />
            Window
          </Badge>
          <Select
            value={String(rangeDays)}
            onValueChange={(v) => {
              if (!v) return;
              setRangeDays(Number(v) as 7 | 30 | 90);
            }}
          >
            <SelectTrigger className="w-[11rem] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <ContextualHint hintId="reports" />

      {isError ? (
        <Card className="rounded-2xl border border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Could not load analytics</CardTitle>
            <CardDescription className="space-y-2">
              <p className="text-destructive/90 font-medium">
                {error instanceof Error ? error.message : String(error ?? "Unknown error")}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                If you recently changed the database, apply migrations and reload. The app retries with a
                simpler query when columns or joins are unavailable.
              </p>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? "Retrying…" : "Try again"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportsStatCardLink scrollTargetId="reports-sales-trend" ariaLabel="Jump to sales trend for this window">
          <StatCard
            title="Total sales"
            value={formatUsdTotalInDisplayPreference(analytics.currentTotal, currency, locale)}
            hint={analytics.windowLabel}
            sub={
              analytics.previousTotal > 0 || analytics.currentTotal > 0
                ? `${analytics.deltaPct >= 0 ? "+" : ""}${analytics.deltaPct}% ${analytics.compareLabel}`
                : analytics.compareLabel
            }
            positive={analytics.deltaPct >= 0}
            loading={isPending}
            icon={TrendingUp}
          />
        </ReportsStatCardLink>
        <ReportsStatCardLink scrollTargetId="reports-top-performers" ariaLabel="Jump to top performers and deal counts">
          <StatCard
            title="Transactions"
            value={formatCompactNumber(analytics.txCount)}
            hint="In selected window"
            sub={`Avg deal ${formatUsdTotalInDisplayPreference(analytics.avgDeal, currency, locale)}`}
            loading={isPending}
            icon={Activity}
          />
        </ReportsStatCardLink>
        <ReportsStatCardLink scrollTargetId="reports-by-seller" ariaLabel="Jump to contributors by seller chart">
          <StatCard
            title="Contributors"
            value={String(analytics.uniqueSellers)}
            hint="Distinct sellers"
            sub={`${analytics.uniqueSellers} distinct seller${analytics.uniqueSellers === 1 ? "" : "s"} in window`}
            loading={isPending}
            icon={Users}
          />
        </ReportsStatCardLink>
        <StatCard
          title="Industries"
          value={String(new Set(analytics.currentRows.map((r) => r.industry)).size)}
          hint="Distinct industry tags"
          sub="Waryt Furniture sales"
          loading={isPending}
          icon={Layers}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card id="reports-sales-trend" className="scroll-mt-24 rounded-2xl border lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="text-primary size-5" />
              Sales trend
            </CardTitle>
            <CardDescription>Daily volume in the selected window</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isPending ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.dailySeries}>
                  <defs>
                    <linearGradient id="repFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatCompactNumber(Number(v))} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12 }}
                    formatter={(v) => [formatUsdTotalInDisplayPreference(Number(v ?? 0), currency, locale), "Sales"]}
                    labelFormatter={(_, payload) =>
                      Array.isArray(payload) && payload[0]?.payload?.label
                        ? String(payload[0].payload.label)
                        : ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--color-primary)"
                    fill="url(#repFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="text-primary size-5" />
              Mix by industry
            </CardTitle>
            <CardDescription>Top segments + other</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isPending ? (
              <ChartSkeleton />
            ) : analytics.pieData.length === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No sales in this window.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {analytics.pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatUsdTotalInDisplayPreference(Number(v ?? 0), currency, locale)} />
                  <Legend layout="horizontal" verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="reports-by-seller" className="scroll-mt-24 rounded-2xl border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="text-primary size-5" />
              By seller
            </CardTitle>
            <CardDescription>Total amount per person (top 10)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {isPending ? (
              <ChartSkeleton />
            ) : analytics.userBarChart.length === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No attributed sales in this window.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.userBarChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCompactNumber(Number(v))} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatUsdTotalInDisplayPreference(Number(v ?? 0), currency, locale)} />
                  <Bar dataKey="total" fill="var(--color-chart-2)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="text-primary size-5" />
              By industry
            </CardTitle>
            <CardDescription>Top industries by revenue (Waryt Furniture)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {isPending ? (
              <ChartSkeleton />
            ) : analytics.industryChart.length === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No industry-tagged sales.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.industryChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={64} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatCompactNumber(Number(v))} />
                  <Tooltip formatter={(v) => formatUsdTotalInDisplayPreference(Number(v ?? 0), currency, locale)} />
                  <Bar dataKey="total" fill="var(--color-chart-3)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Weekday pattern</CardTitle>
            <CardDescription>Where volume lands in the week</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isPending ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dowSeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v) => formatCompactNumber(Number(v))} />
                  <Tooltip formatter={(v) => formatUsdTotalInDisplayPreference(Number(v ?? 0), currency, locale)} />
                  <Bar dataKey="total" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card id="reports-top-performers" className="scroll-mt-24 rounded-2xl border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Top performers</CardTitle>
            <CardDescription>Ranked by total amount logged in the window</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="text-muted-foreground text-sm">Loading…</div>
            ) : analytics.topPeople.length === 0 ? (
              <p className="text-muted-foreground text-sm">No individual sales in this window.</p>
            ) : (
              <div className="max-h-[320px] overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead className="text-right">Deals</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topPeople.map((row, i) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatUsdTotalInDisplayPreference(row.total, currency, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}

function ReportsStatCardLink({
  children,
  scrollTargetId,
  ariaLabel,
}: {
  children: ReactNode;
  scrollTargetId: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="group block w-full cursor-pointer rounded-2xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={() => {
        document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </button>
  );
}

function StatCard({
  title,
  value,
  hint,
  sub,
  positive,
  loading,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  sub: string;
  positive?: boolean;
  loading: boolean;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-2xl border bg-card/80 shadow-sm ring-1 ring-border/50 transition-colors group-hover:border-primary/35 group-hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground size-4 shrink-0 opacity-80" aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="bg-muted h-9 w-28 animate-pulse rounded-lg" />
        ) : (
          <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        )}
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            positive === undefined ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return <div className="bg-muted/50 flex h-full w-full animate-pulse rounded-xl" />;
}
