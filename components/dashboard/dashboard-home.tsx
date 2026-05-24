"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowUpRight,
  Calendar,
  Crown,
  Flame,
  History,
  Medal,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { saleCompanyLine } from "@/lib/sales/sale-company-line";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRoleLabel } from "@/hooks/use-role-label";
import { useFormatMoney } from "@/lib/display-currency-store";
import {
  canAccessManagerRoutes,
  canAccessReports,
  isTaskforceMember,
} from "@/lib/roles";
import type { CustomerSatisfactionReview, Profile, SalesEntry, SatisfactionSummaryRow, UserRole } from "@/lib/types";
import { formatSaleForDisplayPreference, formatUsdTotalInDisplayPreference } from "@/lib/format";
import { saleAmountAsUsdForStats, storedUsdToEntryAmount } from "@/lib/sales-amount-entry";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ContextualHint } from "@/components/onboarding/contextual-hint";
import { WarytLogo } from "@/components/brand/waryt-logo";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

/** Matches `rpc_my_sales_summary` week window: UTC Monday through UTC today (YYYY-MM-DD). */
function utcSalesWeekBounds(): { weekFrom: string; weekTo: string } {
  const now = new Date();
  const d0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d0.getUTCDay();
  const offsetFromMonday = (dow + 6) % 7;
  const mon = new Date(d0);
  mon.setUTCDate(d0.getUTCDate() - offsetFromMonday);
  const ymd = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return { weekFrom: ymd(mon), weekTo: ymd(d0) };
}

type LeaderRow = {
  user_id: string;
  display_name: string;
  total_amount: number;
  rank: number;
};

function displayInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function rankIcon(index: number) {
  switch (index) {
    case 0:
      return <Crown className="size-5 fill-yellow-500 text-yellow-500" aria-hidden />;
    case 1:
      return <Medal className="size-5 fill-slate-400 text-slate-400" aria-hidden />;
    case 2:
      return <Medal className="size-5 fill-amber-600 text-amber-600" aria-hidden />;
    default:
      return (
        <span className="text-muted-foreground text-xs font-bold" aria-hidden>
          #{index + 1}
        </span>
      );
  }
}

export function DashboardHome({
  profile,
  userId,
}: {
  profile: Profile | null;
  userId: string;
}) {
  const role = (profile?.role ?? "agent") as UserRole;
  const roleLabel = useRoleLabel();
  const t = useTranslations("dashboard");
  const tSat = useTranslations("satisfaction");
  const locale = useLocale();
  const [showAnalytics, setShowAnalytics] = useState(false);
  const { money, compactMoney, currency } = useFormatMoney();

  const { weekFrom, weekTo } = utcSalesWeekBounds();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: summary } = useQuery({
    queryKey: ["dashboard", "summary", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_my_sales_summary", {
        p_team_id: null,
      });
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard", "org", weekFrom, weekTo, role],
    enabled: canAccessReports(role),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_org_week_leaderboard", {
        p_from: weekFrom,
        p_to: weekTo,
        p_limit: 5,
      });
      if (error) throw error;
      return (data ?? []) as LeaderRow[];
    },
  });

  const { data: satisfactionSummary = [] } = useQuery({
    queryKey: ["satisfaction", "summary", weekFrom, weekTo],
    enabled: canAccessReports(role),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_satisfaction_summary_for_range", {
        p_from: weekFrom,
        p_to: weekTo,
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

  const { data: myReviews = [] } = useQuery({
    queryKey: ["satisfaction", "mine", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_satisfaction_reviews")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as CustomerSatisfactionReview[];
    },
  });

  const myRankRow = useMemo(() => {
    return leaderboard.find((r) => r.user_id === userId) ?? null;
  }, [leaderboard, userId]);

  const { data: activeTarget } = useQuery({
    queryKey: ["dashboard", "target", userId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("*")
        .eq("scope", "user")
        .eq("user_id", userId)
        .lte("starts_on", today)
        .gte("ends_on", today)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const monthSalesUsd = Number(summary?.month ?? 0);
  const targetAmountUsd = activeTarget ? Number(activeTarget.amount) : null;
  const progress =
    targetAmountUsd && targetAmountUsd > 0
      ? Math.min(100, Math.round((monthSalesUsd / targetAmountUsd) * 100))
      : null;

  const { data: recent = [] } = useQuery({
    queryKey: ["dashboard", "recent", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_entries")
        .select(
          "id,amount,amount_currency,sale_date,created_at,industry,customer_name,prospect_id,studio_prospects(business_name)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as Array<
        Pick<SalesEntry, "id" | "amount" | "amount_currency" | "sale_date" | "created_at" | "industry" | "customer_name" | "prospect_id"> & {
          studio_prospects?: { business_name?: string | null } | { business_name?: string | null }[] | null;
        }
      >;
    },
  });

  const { data: wow } = useQuery({
    queryKey: ["dashboard", "wow", userId],
    queryFn: async () => {
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const end = new Date();
      const thisStart = new Date(end);
      thisStart.setDate(end.getDate() - 6);

      const prevEnd = new Date(thisStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - 6);

      const [{ data: thisWeek }, { data: prevWeek }] = await Promise.all([
        supabase
          .from("sales_entries")
          .select("amount,amount_currency")
          .eq("user_id", userId)
          .gte("sale_date", fmt(thisStart))
          .lte("sale_date", fmt(end)),
        supabase
          .from("sales_entries")
          .select("amount,amount_currency")
          .eq("user_id", userId)
          .gte("sale_date", fmt(prevStart))
          .lte("sale_date", fmt(prevEnd)),
      ]);

      const sum = (rows: { amount: number; amount_currency?: string | null }[] | null) =>
        rows?.reduce((a, r) => a + saleAmountAsUsdForStats(Number(r.amount), r.amount_currency), 0) ?? 0;

      const a = sum(thisWeek as { amount: number }[] | null);
      const b = sum(prevWeek as { amount: number }[] | null);
      if (b === 0) return a > 0 ? 100 : 0;
      return Math.round(((a - b) / b) * 100);
    },
  });

  const { data: streak } = useQuery({
    queryKey: ["dashboard", "streak", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_entries")
        .select("sale_date")
        .eq("user_id", userId)
        .order("sale_date", { ascending: false })
        .limit(800);
      if (error) throw error;
      const days = new Set((data ?? []).map((r) => String(r.sale_date)));

      let count = 0;
      const cursor = new Date();
      for (let i = 0; i < 400; i += 1) {
        const key = cursor.toISOString().slice(0, 10);
        if (days.has(key)) {
          count += 1;
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        if (count === 0) {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        break;
      }

      return count;
    },
  });

  const { data: teamSeries = [] } = useQuery({
    queryKey: ["dashboard", "orgSeries", role, currency],
    enabled: canAccessManagerRoutes(role) && showAnalytics,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 29);
      const from = start.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("sales_entries")
        .select("sale_date,amount,amount_currency")
        .gte("sale_date", from)
        .order("sale_date", { ascending: true });
      if (error) throw error;

      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const k = row.sale_date as string;
        const usd = saleAmountAsUsdForStats(Number(row.amount), row.amount_currency);
        map.set(k, (map.get(k) ?? 0) + usd);
      }
      const out: { day: string; total: number }[] = [];
      for (let i = 0; i < 30; i += 1) {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        const key = d.toISOString().slice(0, 10);
        out.push({ day: key.slice(5), total: storedUsdToEntryAmount(map.get(key) ?? 0, currency) });
      }
      return out;
    },
  });

  const insight =
    typeof wow === "number"
      ? wow >= 0
        ? t("insightUp", { pct: wow })
        : t("insightDown", { pct: Math.abs(wow) })
      : null;

  const headline = isTaskforceMember(role)
    ? t("headlineMomentum")
    : role === "manager"
      ? t("headlineTeam")
      : t("headlineCompany");

  const guest = t("guestName");
  const displayName = profile?.display_name?.trim().split(/\s+/)[0] ?? guest;

  return (
    <div className="relative w-full max-w-none space-y-10 overflow-hidden pb-16">
      <div
        className="pointer-events-none absolute -left-24 top-0 size-[26rem] rounded-full bg-primary/[0.09] blur-3xl dark:bg-primary/[0.12]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-28 top-32 size-[22rem] rounded-full bg-[color-mix(in_srgb,var(--brand-accent-red)_14%,transparent)] blur-3xl opacity-80 dark:opacity-30"
        aria-hidden
      />

      <header className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-5 md:flex-row md:items-center md:gap-6 lg:gap-10">
          <div className="max-w-2xl flex-1 space-y-3 rounded-3xl border border-border/50 bg-card/55 p-6 shadow-lg shadow-black/[0.03] ring-1 ring-primary/10 backdrop-blur-md dark:bg-card/40 dark:ring-primary/15 md:p-8">
            <p className="text-primary text-[11px] font-bold uppercase tracking-[0.2em]">{headline}</p>
            <h1 className="text-foreground text-3xl font-extrabold tracking-tight md:text-4xl lg:text-[2.65rem] lg:leading-[1.1]">
              {t("welcomeTitle", { name: displayName })}
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
              {isTaskforceMember(role) ? t("subtitleTaskforce") : t("subtitleDefault")}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary" className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold">
                {roleLabel(role)}
              </Badge>
              {typeof streak === "number" && streak > 0 ? (
                <Badge className="rounded-full border-0 bg-gradient-to-r from-primary to-[color-mix(in_srgb,var(--primary)_70%,#1a4d99)] px-3 py-1 text-primary-foreground shadow-md">
                  <Flame className="mr-1 size-3" />
                  {t("dayStreak", { count: streak })}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-1 items-center justify-center py-2 md:max-w-[min(100%,440px)] md:justify-end md:py-0 lg:max-w-[min(100%,480px)]">
            <WarytLogo variant="home" priority className="w-full justify-center md:justify-end" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 to-muted/30 px-5 py-3 shadow-md backdrop-blur-sm dark:from-card/50 dark:to-card/30 lg:self-center">
          <Calendar className="text-primary size-5 shrink-0" aria-hidden />
          <span className="text-sm font-bold tracking-tight">
            {new Date().toLocaleDateString(locale === "en" ? "en-US" : locale === "am" ? "am-ET" : "om-ET", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </header>

      <ContextualHint hintId="home" />

      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden rounded-3xl border-0 bg-gradient-to-br from-primary via-primary to-[color-mix(in_srgb,var(--primary)_65%,#153a99)] text-primary-foreground shadow-2xl shadow-primary/30">
          <div className="absolute right-0 top-0 p-8 opacity-[0.12]" aria-hidden>
            <Target className="size-32" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_55%)]" aria-hidden />
          <CardContent className="relative z-10 space-y-5 p-8 md:p-9">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/20 p-2">
                <Target className="text-accent size-6" />
              </div>
              <p className="text-lg font-medium opacity-90">{t("personalTarget")}</p>
            </div>
            {progress === null ? (
              <p className="text-sm opacity-90">
                {t.rich("setTargetCta", {
                  salesLog: (chunks) => (
                    <Link className="font-semibold underline underline-offset-4" href="/sales?tab=log">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div className="text-4xl font-bold tabular-nums tracking-tight">{progress}%</div>
                  <div className="text-right text-sm opacity-80">
                    <div>{formatUsdTotalInDisplayPreference(monthSalesUsd, currency, locale)} {t("logged")}</div>
                    <div>
                      {t("goal")} {formatUsdTotalInDisplayPreference(targetAmountUsd ?? 0, currency, locale)}
                    </div>
                  </div>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-accent">{t("pctComplete", { pct: progress })}</span>
                  <span className="opacity-75">
                    {t("toGo", {
                      amount: formatUsdTotalInDisplayPreference(
                        Math.max((targetAmountUsd ?? 0) - monthSalesUsd, 0),
                        currency,
                        locale,
                      ),
                    })}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-full rounded-3xl border border-border/50 bg-gradient-to-br from-card/95 to-card/70 shadow-xl shadow-black/[0.04] ring-1 ring-black/[0.04] backdrop-blur-sm dark:from-card/60 dark:to-card/40 dark:ring-white/[0.06]">
          <CardContent className="flex h-full flex-col justify-between p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/5 p-2 text-primary">
                  <TrendingUp className="size-6" />
                </div>
                <p className="font-medium text-muted-foreground">{t("today")}</p>
              </div>
              {typeof wow === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-xs font-bold",
                    wow >= 0
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
                  )}
                >
                  <span className="inline-flex items-center gap-0.5">
                    <ArrowUpRight className="size-3" />
                    {wow >= 0 ? "+" : ""}
                    {wow}%
                  </span>
                  <span className="sr-only"> {t("weekCompare")}</span>
                </span>
              ) : null}
            </div>
            <div>
              <h3 className="mb-1 text-4xl font-bold tracking-tight text-foreground tabular-nums">
                {formatUsdTotalInDisplayPreference(Number(summary?.today ?? 0), currency, locale)}
              </h3>
              <p className="text-muted-foreground text-sm">{t("loggedTodayContext")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full rounded-3xl border border-border/50 bg-gradient-to-br from-card/95 to-card/70 shadow-xl shadow-black/[0.04] ring-1 ring-black/[0.04] backdrop-blur-sm dark:from-card/60 dark:to-card/40 dark:ring-white/[0.06] md:col-span-2 lg:col-span-1">
          <CardContent className="flex h-full flex-col justify-between p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-lg bg-primary/5 p-2 text-primary">
                <Sparkles className="size-6" />
              </div>
              <p className="font-medium text-muted-foreground">{t("thisWeek")}</p>
            </div>
            <div>
              <h3 className="mb-1 text-4xl font-bold tracking-tight text-foreground tabular-nums">
                {formatUsdTotalInDisplayPreference(Number(summary?.week ?? 0), currency, locale)}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("monthRunning", { amount: formatUsdTotalInDisplayPreference(monthSalesUsd, currency, locale) })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {insight ? (
        <div className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-accent/40 to-transparent px-5 py-4 shadow-md backdrop-blur-sm">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <div className="text-sm font-medium">{t("insightLabel")}</div>
            <div className="text-muted-foreground text-sm">{insight}</div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="border-none bg-white/40 shadow-xl shadow-black/5 backdrop-blur-md dark:bg-card/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <History className="text-primary size-5" />
                {t("recentSalesTitle")}
              </CardTitle>
              <Link
                href="/sales?tab=log"
                className="text-primary text-sm font-bold hover:underline"
              >
                {t("viewAll")}
              </Link>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-muted-foreground py-6 text-sm">{t("recentEmpty")}</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {recent.map((sale) => (
                    <div
                      key={sale.id}
                      className="group -mx-4 flex cursor-pointer items-center justify-between px-4 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                          <ArrowUpRight className="size-6" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{saleCompanyLine(sale)}</p>
                          <p className="text-muted-foreground text-xs">{t("sectorLine", { industry: sale.industry })}</p>
                          <p className="text-muted-foreground text-[11px]">{sale.sale_date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold tabular-nums text-foreground">
                          {formatSaleForDisplayPreference(Number(sale.amount), sale.amount_currency, currency, locale)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Separator className="my-4" />
              <Link
                href="/sales?tab=log"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl font-semibold",
                )}
              >
                {t("salesLogButton")}
                <ArrowUpRight className="size-4" />
              </Link>
            </CardContent>
          </Card>

          {targetAmountUsd != null && targetAmountUsd > 0 ? (
            <div className="relative flex min-h-[200px] items-center overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground">
              <div
                className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-accent/30 to-transparent opacity-90"
                aria-hidden
              />
              <div className="relative z-10 max-w-lg space-y-4">
                <h3 className="text-3xl font-bold text-white">{t("readyHitTarget")}</h3>
                <p className="text-white/75">{t("progressCopy", { pct: progress ?? 0 })}</p>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-xl bg-accent px-4 py-2 font-bold text-accent-foreground shadow-lg shadow-black/20">
                    {t("goalChip", { amount: formatUsdTotalInDisplayPreference(targetAmountUsd, currency, locale) })}
                  </div>
                  {typeof streak === "number" && streak > 0 ? (
                    <div className="rounded-xl bg-white/15 px-4 py-2 font-bold text-white backdrop-blur-md">
                      {t("streakChip", { days: streak })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-1">
          <Card className="border-none shadow-xl shadow-black/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Trophy className="text-accent size-5" />
                {t("topPerformers")}
              </CardTitle>
              <Badge variant="outline" className="border-primary/20 font-medium text-primary">
                {t("thisWeekBadge")}
              </Badge>
            </CardHeader>
            <CardContent>
              {!canAccessReports(role) ? (
                <p className="text-muted-foreground mt-4 text-sm">{t("leaderboardSignIn")}</p>
              ) : leaderboard.length === 0 ? (
                <p className="text-muted-foreground mt-4 text-sm">
                  {isTaskforceMember(role) ? t("leaderboardEmptyRep") : t("leaderboardEmptyManager")}
                </p>
              ) : (
                <div className="mt-4 space-y-6">
                  {myRankRow ? (
                    <p className="text-muted-foreground text-xs font-medium">
                      {t("rankYou", { rank: myRankRow.rank })}
                    </p>
                  ) : null}
                  {leaderboard.map((user, index) => {
                    const pct =
                      targetAmountUsd && targetAmountUsd > 0
                        ? Math.min(100, Math.round((Number(user.total_amount) / targetAmountUsd) * 100))
                        : 0;
                    return (
                      <div
                        key={user.user_id}
                        className="group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex w-8 justify-center">{rankIcon(index)}</div>
                          <Avatar className="size-12 border-2 border-transparent transition-colors group-hover:border-accent">
                            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                              {displayInitials(user.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground transition-colors group-hover:text-primary">
                              {user.display_name}
                              {user.user_id === userId ? (
                                <span className="text-muted-foreground ml-1 text-xs font-normal">{t("youTag")}</span>
                              ) : null}
                            </p>
                            <p className="text-muted-foreground text-xs">{t("rankPeriod", { rank: user.rank })}</p>
                            {(() => {
                              const sat = satisfactionByUser.get(user.user_id);
                              if (!sat || sat.count === 0) return null;
                              return (
                                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                                  {sat.avg.toFixed(1)} · {tSat("reviewCount", { count: sat.count })}
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold tabular-nums text-foreground">
                            {compactMoney(storedUsdToEntryAmount(Number(user.total_amount), currency))}
                          </p>
                          <div className="mt-1 flex justify-end">
                            <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-2xl border bg-muted/10 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
            {tSat("myReviewsTitle")}
          </CardTitle>
          <CardDescription>{tSat("myReviewsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {myReviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">{tSat("recentEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {myReviews.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{r.customer_name}</p>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(r.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5" aria-label={`${r.rating} stars`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          "size-4",
                          n <= r.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-muted/30 text-muted-foreground/30",
                        )}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!isTaskforceMember(role) ? (
        <Card className="rounded-2xl border bg-muted/20 shadow-sm ring-1 ring-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>{t("salesAnalytics")}</CardTitle>
              <CardDescription>{t("salesAnalyticsDesc")}</CardDescription>
            </div>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
              onClick={() => setShowAnalytics((v) => !v)}
            >
              <TrendingUp className="mr-2 size-4" />
              {showAnalytics ? t("hideChart") : t("showChart")}
            </button>
          </CardHeader>
          {showAnalytics ? (
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={teamSeries}>
                  <defs>
                    <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12 }}
                    formatter={(v) => [money(Number(v ?? 0)), t("chartSeriesName")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--color-chart-2)"
                    fill="url(#fillTotal)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
