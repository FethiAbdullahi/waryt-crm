"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormatMoney } from "@/lib/display-currency-store";
import { COMMISSION_MAX_MONTHS, COMMISSION_RATE, currentQuarterUtcRange } from "@/lib/studio-dates";
import {
  studioPerformanceQuarterSalesKey,
  studioProspectsQueryKey,
  studioQuarterTargetOverlapSumKey,
} from "@/lib/sales-studio/query-keys";
import { quarterClosedRevenueUsd } from "@/lib/sales-studio/quarter-closed-revenue";
import { saleAmountAsUsdForStats } from "@/lib/sales-amount-entry";
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

export function StudioPerformanceClient({ userId }: { userId: string }) {
  const t = useTranslations("studioPanels.performance");
  const { money } = useFormatMoney();
  const { fromIso, toIso } = currentQuarterUtcRange();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const { data: prospects = [] } = useQuery({
    queryKey: studioProspectsQueryKey(userId),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("studio_prospects").select("*");
      if (error) throw error;
      return (data ?? []) as StudioProspect[];
    },
  });

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

  const closedThisQuarter = wonProspectsThisQuarter.length;
  const wonProspectIdsThisQuarter = useMemo(
    () => new Set(wonProspectsThisQuarter.map((p) => p.id)),
    [wonProspectsThisQuarter],
  );

  /** Sales log rows this quarter that are not already represented by a closed-won pipeline row. */
  const deskSalesCountExtra = useMemo(
    () =>
      quarterSales.filter((s) => {
        const pid = s.prospect_id;
        return pid == null || !wonProspectIdsThisQuarter.has(pid);
      }).length,
    [quarterSales, wonProspectIdsThisQuarter],
  );

  const quarterRevenueUsd = useMemo(
    () => quarterClosedRevenueUsd(wonProspectsThisQuarter, quarterSales),
    [wonProspectsThisQuarter, quarterSales],
  );

  /** Paying pipeline rows: sales linked here are counted in mrr_monthly, not again as “desk”. */
  const payingProspectIds = useMemo(
    () => new Set(mine.filter((p) => p.account_status === "paying").map((p) => p.id)),
    [mine],
  );

  const deskOrphanSales = useMemo(
    () =>
      quarterSales.filter((s) => {
        const pid = s.prospect_id;
        return pid == null || !payingProspectIds.has(pid);
      }),
    [quarterSales, payingProspectIds],
  );

  const deskOrphanVolume = useMemo(
    () =>
      deskOrphanSales.reduce(
        (a, s) => a + saleAmountAsUsdForStats(Number(s.amount ?? 0), s.amount_currency),
        0,
      ),
    [deskOrphanSales],
  );

  const paying = mine.filter((p) => p.account_status === "paying");
  const mrrTotal = paying.reduce((a, p) => a + Number(p.mrr_monthly ?? 0), 0);
  const combinedCreditBase = mrrTotal + deskOrphanVolume;
  const estMonthlyCommission = combinedCreditBase * COMMISSION_RATE;

  const payingCount = paying.length;
  const atRiskCount = mine.filter((p) =>
    ["non_paying", "expired", "churned"].includes(p.account_status),
  ).length;
  const prospectCount = mine.filter((p) => p.account_status === "active_prospect").length;

  const quarterProgress =
    quarterTargetSum > 0
      ? Math.min(100, Math.round((quarterRevenueUsd / quarterTargetSum) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("quarterRevenueTitle")}</CardTitle>
          <CardDescription>{t("quarterRevenueDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <span className="text-3xl font-bold tabular-nums">{money(quarterRevenueUsd)}</span>
            {quarterTargetSum > 0 ? (
              <span className="text-muted-foreground text-sm">
                {t("ofTargetRevenue", { target: money(quarterTargetSum) })}
              </span>
            ) : (
              <span className="text-muted-foreground max-w-xs text-sm leading-relaxed">
                {t("noQuarterTargetHint")}{" "}
                <Link href="/settings" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0 align-baseline")}>
                  {t("setTargetsLink")}
                </Link>
              </span>
            )}
          </div>
          <Progress value={quarterTargetSum > 0 ? quarterProgress : 0} className="h-2" />
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("pipelineClosedWon", { count: closedThisQuarter })}
            {deskSalesCountExtra > 0 ? <> {t("salesLogExtra", { count: deskSalesCountExtra })}</> : null}
            {" "}
            {t("quarterRevenueFootnote")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("creditBaseTitle")}</CardTitle>
            <CardDescription>{t("creditBaseDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <span className="text-muted-foreground text-sm">{t("combinedTotal")}</span>
              <span className="block text-2xl font-bold tabular-nums">
                {money(combinedCreditBase)}
              </span>
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("pipelinePaying", { amount: money(mrrTotal) })}
              {deskOrphanVolume > 0 ? (
                <>
                  {" "}
                  {t("deskUnlinked", {
                    amount: money(deskOrphanVolume),
                    count: deskOrphanSales.length,
                    sfx: deskOrphanSales.length === 1 ? "" : "s",
                  })}
                </>
              ) : null}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("estimatedCommissionTitle")}</CardTitle>
            <CardDescription>
              {t("estimatedCommissionDescription", {
                rate: Math.round(COMMISSION_RATE * 100),
                months: COMMISSION_MAX_MONTHS,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{money(estMonthlyCommission)}</p>
            <p className="text-muted-foreground mt-1 text-xs">{t("estimatedCommissionFootnote")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("accountMixTitle")}</CardTitle>
            <CardDescription>{t("accountMixDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">{t("paying")}</span>{" "}
              <span className="font-semibold">{payingCount}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("activeProspects")}</span>{" "}
              <span className="font-semibold">{prospectCount}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("nonPaying")}</span>{" "}
              <span className="font-semibold">{atRiskCount}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
