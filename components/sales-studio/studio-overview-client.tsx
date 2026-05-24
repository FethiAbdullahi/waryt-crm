"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import Link from "next/link";
import { useMessages, useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormatMoney } from "@/lib/display-currency-store";
import { SALES_STUDIO_NAV } from "@/lib/sales-studio/routes";
import { useSalesStudioNav } from "@/lib/sales-studio/sales-studio-nav-context";
import { currentQuarterUtcRange } from "@/lib/studio-dates";
import {
  studioPerformanceQuarterSalesKey,
  studioProspectsQueryKey,
  studioQuarterTargetOverlapSumKey,
} from "@/lib/sales-studio/query-keys";
import { quarterClosedRevenueUsd } from "@/lib/sales-studio/quarter-closed-revenue";
import type { StudioProspect } from "@/lib/types";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

type QuarterSaleRow = {
  id: string;
  amount: number | string;
  amount_currency?: string | null;
  sale_date: string;
  prospect_id: string | null;
};

export function StudioOverviewClient({ userId }: { userId: string }) {
  const messages = useMessages();
  const tOverview = useTranslations("studioWorkspace.overview");
  const { money } = useFormatMoney();
  const { goTab } = useSalesStudioNav();

  const { data: prospects = [] } = useQuery({
    queryKey: studioProspectsQueryKey(userId),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("studio_prospects").select("*");
      if (error) throw error;
      return (data ?? []) as StudioProspect[];
    },
  });

  const { data: openAlerts = 0 } = useQuery({
    queryKey: ["studio", "alerts-open-count", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("studio_alerts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("resolved_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { fromIso, toIso } = currentQuarterUtcRange();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const { data: quarterSales = [] } = useQuery({
    queryKey: studioPerformanceQuarterSalesKey(userId, fromDate, toDate),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_entries")
        .select("id,amount,amount_currency,sale_date,prospect_id")
        .eq("user_id", userId)
        .gte("sale_date", fromDate)
        .lte("sale_date", toDate);
      if (error) throw error;
      return (data ?? []) as QuarterSaleRow[];
    },
  });

  const { data: quarterTargetSum = 0 } = useQuery({
    queryKey: studioQuarterTargetOverlapSumKey(userId, fromDate, toDate),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("amount")
        .eq("user_id", userId)
        .eq("scope", "user")
        .lte("starts_on", toDate)
        .gte("ends_on", fromDate);
      if (error) throw error;
      return (data ?? []).reduce((a, row) => a + Number(row.amount ?? 0), 0);
    },
  });

  const mine = prospects.filter((p) => p.owner_id === userId);

  const wonProspectsThisQuarter = useMemo(
    () =>
      mine.filter(
        (p) =>
          p.stage === "won" &&
          p.closed_deal_at != null &&
          p.closed_deal_at >= fromIso &&
          p.closed_deal_at <= toIso,
      ),
    [mine, fromIso, toIso],
  );

  const quarterRevenueUsd = useMemo(
    () => quarterClosedRevenueUsd(wonProspectsThisQuarter, quarterSales),
    [wonProspectsThisQuarter, quarterSales],
  );

  const mrr = mine
    .filter((p) => p.account_status === "paying")
    .reduce((a, p) => a + Number(p.mrr_monthly ?? 0), 0);

  const quarterProgress =
    quarterTargetSum > 0
      ? Math.min(100, Math.round((quarterRevenueUsd / quarterTargetSum) * 100))
      : 0;

  const navLinks = SALES_STUDIO_NAV.filter(
    (n) => n.tab !== "overview" && n.tab !== "log" && n.tab !== "field",
  );
  const logNav = SALES_STUDIO_NAV.find((n) => n.tab === "log");
  const fieldNav = SALES_STUDIO_NAV.find((n) => n.tab === "field");

  const studioTabs = (
    messages as { studioWorkspace?: { tabs?: Record<string, { label: string; description: string }> } }
  ).studioWorkspace?.tabs;
  const tabCopy = (tab: string) => studioTabs?.[tab] ?? { label: tab, description: "" };

  return (
    <div className="space-y-10 pb-8">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>{tOverview("quarterDealTitle")}</CardTitle>
            <CardDescription>{tOverview("quarterDealDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-2xl font-bold tabular-nums">{money(quarterRevenueUsd)}</p>
              {quarterTargetSum > 0 ? (
                <p className="text-muted-foreground text-sm">
                  {tOverview("quarterTargetOf", { target: money(quarterTargetSum) })}
                </p>
              ) : (
                <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
                  {tOverview("quarterNoTargetHint")}{" "}
                  <Link href="/settings" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0 align-baseline")}>
                    {tOverview("quarterSetTargetsLink")}
                  </Link>
                </p>
              )}
            </div>
            <Progress value={quarterTargetSum > 0 ? quarterProgress : 0} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{tOverview("creditAlertsTitle")}</CardTitle>
            <CardDescription>{tOverview("creditAlertsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">{tOverview("creditBaseLabel")}</span>{" "}
              <span className="font-semibold tabular-nums">{money(mrr)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{tOverview("openRemindersLabel")}</span>{" "}
              <span className="font-semibold">{openAlerts}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 rounded-xl"
              onClick={() => goTab("alerts")}
            >
              {tOverview("openAlerts")}
              <ArrowUpRight className="ml-1 size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{tOverview("workspaceAreas")}</h2>
        {logNav && fieldNav ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {[logNav, fieldNav].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => goTab(item.tab)}
                  className="group block w-full rounded-2xl text-left"
                >
                  <Card className="h-full border-border/80 transition-shadow group-hover:shadow-md">
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                      <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-snug">{tabCopy(item.tab).label}</CardTitle>
                        <CardDescription className="mt-1 text-[13px] leading-relaxed">
                          {tabCopy(item.tab).description}
                        </CardDescription>
                      </div>
                      <ArrowUpRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </CardHeader>
                  </Card>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => goTab(item.tab)}
                className="group block w-full rounded-2xl text-left"
              >
                <Card className="h-full border-border/80 transition-shadow group-hover:shadow-md">
                  <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                    <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-snug">{tabCopy(item.tab).label}</CardTitle>
                      <CardDescription className="mt-1 text-[13px] leading-relaxed">
                        {tabCopy(item.tab).description}
                      </CardDescription>
                    </div>
                    <ArrowUpRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardHeader>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
