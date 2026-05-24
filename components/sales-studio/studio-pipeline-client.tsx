"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Factory,
  Layers,
  MessageSquarePlus,
  Pencil,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ActivityFormDialog } from "@/components/sales-studio/activity-form-dialog";
import { PipelineBulkImportDialog } from "@/components/sales-studio/pipeline-bulk-import-dialog";
import { PipelineProspectDetailDialog } from "@/components/sales-studio/pipeline-prospect-detail-dialog";
import { PipelineWonAmountDialog } from "@/components/sales-studio/pipeline-won-amount-dialog";
import { ProspectFormDialog } from "@/components/sales-studio/prospect-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useFormatMoney } from "@/lib/display-currency-store";
import { isOrgAdmin, isTaskforceMember } from "@/lib/roles";
import { useSatisfactionStore } from "@/lib/stores/satisfaction-store";
import { labelAccountStatus, labelStage, STUDIO_STAGES } from "@/lib/sales-studio/routes";
import { normalizePipelineBusinessName } from "@/lib/sales-studio/business-name";
import {
  studioPerformanceQuarterSalesKey,
  studioQuarterTargetOverlapSumKey,
  studioProspectsQueryKey,
} from "@/lib/sales-studio/query-keys";
import { quarterClosedRevenueUsd } from "@/lib/sales-studio/quarter-closed-revenue";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { currentQuarterUtcRange } from "@/lib/studio-dates";
import { storedUsdToEntryAmount } from "@/lib/sales-amount-entry";
import type { StudioProspect, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

const PIPELINE_PAGE_SIZE = 20;

/** Sticky header cells inside the pipeline scroll region (opaque bg so rows don’t show through). */
const pipelineStickyTh =
  "sticky top-0 z-20 border-b border-border bg-background px-2 py-2 align-middle shadow-sm";

function parseProspectRows(data: unknown[], withOwnerEmbed: boolean): StudioProspect[] {
  if (!withOwnerEmbed) return (data ?? []) as StudioProspect[];
  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const prof = row.profiles as
      | { display_name?: string | null }
      | { display_name?: string | null }[]
      | null
      | undefined;
    let owner_display_name: string | null = null;
    if (prof && !Array.isArray(prof) && typeof prof === "object") {
      const d = prof.display_name;
      owner_display_name = d != null && String(d).trim() !== "" ? String(d).trim() : null;
    } else if (Array.isArray(prof) && prof[0] && typeof prof[0] === "object") {
      const d = (prof[0] as { display_name?: string | null }).display_name;
      owner_display_name = d != null && String(d).trim() !== "" ? String(d).trim() : null;
    }
    const tm = row.teams as
      | { name?: string | null }
      | { name?: string | null }[]
      | null
      | undefined;
    let team_name: string | null = null;
    if (tm && !Array.isArray(tm) && typeof tm === "object") {
      const n = (tm as { name?: string | null }).name;
      team_name = n != null && String(n).trim() !== "" ? String(n).trim() : null;
    } else if (Array.isArray(tm) && tm[0] && typeof tm[0] === "object") {
      const n = (tm[0] as { name?: string | null }).name;
      team_name = n != null && String(n).trim() !== "" ? String(n).trim() : null;
    }
    const { profiles, teams, ...rest } = row;
    void profiles;
    void teams;
    return { ...rest, owner_display_name, team_name } as StudioProspect;
  });
}

type WonFlowState = {
  id: string;
  businessName: string;
  initialStoredUsd: number | null;
};

type PipelineStageFilter = "all" | (typeof STUDIO_STAGES)[number];

export function StudioPipelineClient({ userId, role }: { userId: string; role: UserRole }) {
  const t = useTranslations("studioPipeline");
  const qc = useQueryClient();
  const { money, currency } = useFormatMoney();
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [nameQuery, setNameQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStageFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProspect, setEditProspect] = useState<StudioProspect | null>(null);
  const [activityProspect, setActivityProspect] = useState<StudioProspect | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [wonFlow, setWonFlow] = useState<WonFlowState | null>(null);
  const [detailProspect, setDetailProspect] = useState<StudioProspect | null>(null);
  const [showTableScrollTop, setShowTableScrollTop] = useState(false);
  const [pipelinePage, setPipelinePage] = useState(1);
  const pipelineTableScrollRef = useRef<HTMLDivElement>(null);

  const showAddedBy = isOrgAdmin(role);

  const onPipelineTableScroll = useCallback(() => {
    const el = pipelineTableScrollRef.current;
    if (!el) return;
    setShowTableScrollTop(el.scrollTop > 160);
  }, []);

  const taskforce = isTaskforceMember(role);

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: [...studioProspectsQueryKey(userId), "with-owner-profile"] as const,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_prospects")
        .select("*, profiles(display_name), teams(name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return parseProspectRows(data ?? [], true);
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
      return (data ?? []) as {
        id: string;
        amount: number | string;
        amount_currency?: string | null;
        sale_date: string;
        prospect_id: string | null;
      }[];
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

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      const v = p.industry?.trim();
      if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [prospects]);

  const duplicateNameCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prospects) {
      const k = normalizePipelineBusinessName(p.business_name);
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [prospects]);

  const filtered = useMemo(() => {
    let list = prospects;
    if (industryFilter !== "all") list = list.filter((p) => p.industry === industryFilter);
    if (stageFilter !== "all") list = list.filter((p) => p.stage === stageFilter);
    const q = nameQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const biz = p.business_name.toLowerCase();
        const contact = (p.contact_name ?? "").toLowerCase();
        const addedBy = (p.owner_display_name ?? "").toLowerCase();
        const email = (p.contact_email ?? "").toLowerCase();
        const teamN = (p.team_name ?? "").toLowerCase();
        return (
          biz.includes(q) ||
          contact.includes(q) ||
          addedBy.includes(q) ||
          email.includes(q) ||
          teamN.includes(q)
        );
      });
    }
    return list;
  }, [prospects, industryFilter, stageFilter, nameQuery]);

  const pipelineTotalPages = Math.max(1, Math.ceil(filtered.length / PIPELINE_PAGE_SIZE));

  const paginatedFiltered = useMemo(() => {
    const start = (pipelinePage - 1) * PIPELINE_PAGE_SIZE;
    return filtered.slice(start, start + PIPELINE_PAGE_SIZE);
  }, [filtered, pipelinePage]);

  useEffect(() => {
    if (industryFilter !== "all" && !industryOptions.includes(industryFilter)) {
      queueMicrotask(() => setIndustryFilter("all"));
    }
  }, [industryFilter, industryOptions]);

  useEffect(() => {
    queueMicrotask(() => setPipelinePage(1));
  }, [industryFilter, stageFilter, nameQuery]);

  useEffect(() => {
    if (pipelinePage > pipelineTotalPages) {
      queueMicrotask(() => setPipelinePage(pipelineTotalPages));
    }
  }, [pipelinePage, pipelineTotalPages]);

  useEffect(() => {
    queueMicrotask(() => onPipelineTableScroll());
  }, [paginatedFiltered.length, onPipelineTableScroll]);

  const headerPipelineCount = prospects.length;
  const myOwnedCount = useMemo(() => prospects.filter((p) => p.owner_id === userId).length, [prospects, userId]);

  const filtersActive = useMemo(
    () => nameQuery.trim() !== "" || industryFilter !== "all" || stageFilter !== "all",
    [nameQuery, industryFilter, stageFilter],
  );

  const filteredMineCount = useMemo(
    () => filtered.filter((p) => p.owner_id === userId).length,
    [filtered, userId],
  );

  const pipelineBadge = useMemo(() => {
    if (showAddedBy) {
      return filtersActive
        ? t("badgeMatching", { count: filtered.length })
        : t("badgeTotal", { count: headerPipelineCount });
    }
    if (taskforce) {
      return filtersActive
        ? t("badgeMatching", { count: filtered.length })
        : t("badgeMyPipeline", { count: headerPipelineCount });
    }
    return filtersActive
      ? t("badgeMineMatching", { mine: filteredMineCount, count: filtered.length })
      : t("badgeMineVisible", { mine: myOwnedCount, count: headerPipelineCount });
  }, [
    showAddedBy,
    taskforce,
    filtersActive,
    filtered.length,
    headerPipelineCount,
    filteredMineCount,
    myOwnedCount,
    t,
  ]);

  const quarterRevenueMetrics = useMemo(() => {
    const myWonThisQuarter = prospects.filter(
      (p) =>
        p.owner_id === userId &&
        p.stage === "won" &&
        p.closed_deal_at != null &&
        p.closed_deal_at >= fromIso &&
        p.closed_deal_at <= toIso,
    );
    const revenueUsd = quarterClosedRevenueUsd(myWonThisQuarter, quarterSales);
    return { revenueUsd, targetUsd: quarterTargetSum };
  }, [prospects, userId, fromIso, toIso, quarterSales, quarterTargetSum]);

  const patchStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("studio_prospects").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: studioProspectsQueryKey(userId) }),
    onError: (e: Error) => toast.error(e.message),
  });

  const patchWonWithAmount = useMutation({
    mutationFn: async ({
      id,
      closed_deal_amount,
      customerName,
    }: {
      id: string;
      closed_deal_amount: number | null;
      customerName: string;
    }) => {
      const { error } = await supabase
        .from("studio_prospects")
        .update({ stage: "won", closed_deal_amount, account_status: "paying" })
        .eq("id", id);
      if (error) throw error;
      return { id, customerName };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: studioProspectsQueryKey(userId) });
      setWonFlow(null);
      toast.success(t("toastStageWon"));
      useSatisfactionStore.getState().openPrompt({
        customerName: result.customerName,
        prospectId: result.id,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onPickStage(p: StudioProspect, nextStage: string | null | undefined) {
    if (!nextStage) return;
    if (nextStage === "won" && p.stage !== "won") {
      setWonFlow({
        id: p.id,
        businessName: p.business_name,
        initialStoredUsd:
          p.closed_deal_amount != null && Number.isFinite(Number(p.closed_deal_amount))
            ? Number(p.closed_deal_amount)
            : null,
      });
      return;
    }
    patchStage.mutate({ id: p.id, stage: nextStage });
  }

  return (
    <div className="min-w-0 space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{t("cardTitle")}</CardTitle>
              <Badge variant="secondary" className="rounded-full font-normal">
                {pipelineBadge}
              </Badge>
            </div>
            <CardDescription>
              {t("description", {
                revenue: money(quarterRevenueMetrics.revenueUsd),
                target:
                  quarterRevenueMetrics.targetUsd > 0
                    ? money(quarterRevenueMetrics.targetUsd)
                    : t("descriptionNoTarget"),
              })}
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" className="rounded-xl shadow-sm" onClick={() => setBulkOpen(true)}>
              <Upload className="mr-2 size-4" />
              {t("bulkImport")}
            </Button>
            <Button
              className="rounded-xl shadow-sm"
              onClick={() => {
                setEditProspect(null);
                setCreateOpen(true);
              }}
            >
              {t("newLead")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-muted/40 to-muted/10 p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="bg-background flex size-8 items-center justify-center rounded-lg border border-border/80 shadow-sm">
                <SlidersHorizontal className="text-muted-foreground size-4" aria-hidden />
              </span>
              {t("filters")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="pipe-search" className="text-muted-foreground text-xs font-medium">
                  {t("searchLabel")}
                </Label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="pipe-search"
                    className="h-10 rounded-xl border-border/80 bg-background pl-9 shadow-sm"
                    placeholder={t("searchPlaceholder")}
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    aria-label={t("searchAria")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pipe-industry" className="text-muted-foreground text-xs font-medium">
                  {t("industryLabel")}
                </Label>
                <Select value={industryFilter} onValueChange={(v) => setIndustryFilter(v ?? "all")}>
                  <SelectTrigger id="pipe-industry" className="h-10 w-full rounded-xl border-border/80 bg-background shadow-sm">
                    <div className="flex items-center gap-2">
                      <Factory className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      <SelectValue placeholder={t("allIndustries")} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allIndustries")}</SelectItem>
                    {industryOptions.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i.length > 48 ? `${i.slice(0, 46)}…` : i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pipe-stage" className="text-muted-foreground text-xs font-medium">
                  {t("stageLabel")}
                </Label>
                <Select
                  value={stageFilter}
                  onValueChange={(v) => {
                    if (!v || v === "all") setStageFilter("all");
                    else setStageFilter(v as (typeof STUDIO_STAGES)[number]);
                  }}
                >
                  <SelectTrigger id="pipe-stage" className="h-10 w-full rounded-xl border-border/80 bg-background shadow-sm">
                    <div className="flex items-center gap-2">
                      <Layers className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      <SelectValue placeholder={t("allStages")} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allStages")}</SelectItem>
                    {STUDIO_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {labelStage(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(nameQuery.trim() || industryFilter !== "all" || stageFilter !== "all") && (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-muted-foreground"
                  onClick={() => {
                    setNameQuery("");
                    setIndustryFilter("all");
                    setStageFilter("all");
                  }}
                >
                  {t("clearFilters")}
                </Button>
              </div>
            )}
          </div>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("emptyFilters")}</p>
          ) : (
            <div className="relative min-w-0">
              <div
                ref={pipelineTableScrollRef}
                onScroll={onPipelineTableScroll}
                className="isolate max-h-[min(72vh,56rem)] min-h-0 overflow-y-auto overflow-x-clip rounded-xl border"
              >
              <Table
                containerClassName="min-w-0 max-w-full"
                className="table-fixed w-full min-w-[58rem] sm:min-w-[62rem]"
              >
                <TableHeader>
                  <TableRow className="border-b-0 hover:bg-transparent">
                    <TableHead className={cn(pipelineStickyTh, "w-[30%] min-w-0")}>{t("colBusiness")}</TableHead>
                    <TableHead className={cn(pipelineStickyTh, "w-[18%] min-w-0")}>{t("colEmail")}</TableHead>
                    {showAddedBy ? null : (
                      <TableHead className={cn(pipelineStickyTh, "w-[10%] min-w-0")}>{t("colPhone")}</TableHead>
                    )}
                    {showAddedBy ? (
                      <TableHead className={cn(pipelineStickyTh, "w-[11%] min-w-0")}>{t("colAddedBy")}</TableHead>
                    ) : null}
                    <TableHead className={cn(pipelineStickyTh, "w-[12%] min-w-0")}>{t("colIndustry")}</TableHead>
                    <TableHead className={cn(pipelineStickyTh, "w-[140px] min-w-0")}>{t("colStage")}</TableHead>
                    <TableHead className={cn(pipelineStickyTh, "w-[9%] min-w-0")}>{t("colWonAmount")}</TableHead>
                    <TableHead className={cn(pipelineStickyTh, "w-[9%] min-w-0")}>{t("colStatus")}</TableHead>
                    <TableHead className={cn(pipelineStickyTh, "w-[88px] text-right")}>{t("colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFiltered.map((p) => {
                    const dupKey = normalizePipelineBusinessName(p.business_name);
                    const dupCount = dupKey ? (duplicateNameCounts.get(dupKey) ?? 0) : 0;
                    const isDup = dupCount > 1;
                    const wonAmt =
                      p.stage === "won" && p.closed_deal_amount != null && Number(p.closed_deal_amount) > 0
                        ? money(storedUsdToEntryAmount(Number(p.closed_deal_amount), currency))
                        : "—";
                    return (
                      <TableRow
                        key={p.id}
                        className={cn(
                          "group cursor-pointer hover:bg-muted/50",
                          isDup ? "bg-amber-500/5" : undefined,
                        )}
                        title={isDup ? t("dupTitle") : t("viewDetailsTitle")}
                        onClick={() => setDetailProspect(p)}
                      >
                        <TableCell className="min-w-0 font-medium whitespace-normal align-top">
                          <div className="flex flex-wrap items-start gap-2 break-words">
                            <div className="min-w-0">
                              <div className="font-medium underline-offset-2 group-hover:underline">{p.business_name}</div>
                              <div className="text-muted-foreground mt-0.5 text-sm font-normal">
                                {p.contact_name?.trim() || "—"}
                              </div>
                              {p.team_name?.trim() ? (
                                <div className="text-muted-foreground/90 mt-0.5 text-xs font-normal">
                                  Team · {p.team_name.trim()}
                                </div>
                              ) : null}
                            </div>
                            {isDup ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border-amber-500/60 text-xs font-normal"
                              >
                                {t("duplicateNameBadge")}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-0 whitespace-normal break-all text-muted-foreground text-sm align-top">
                          {p.contact_email?.trim() || "—"}
                        </TableCell>
                        {showAddedBy ? null : (
                          <TableCell className="min-w-0 whitespace-normal break-words text-muted-foreground text-sm align-top">
                            {p.contact_phone?.trim() || "—"}
                          </TableCell>
                        )}
                        {showAddedBy ? (
                          <TableCell className="min-w-0 whitespace-normal break-words text-muted-foreground text-sm align-top">
                            {p.owner_display_name?.trim() ? (
                              <span title={p.owner_display_name}>{p.owner_display_name}</span>
                            ) : (
                              <span className="text-muted-foreground/80 font-mono text-xs" title={p.owner_id}>
                                {p.owner_id.slice(0, 8)}…
                              </span>
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell className="min-w-0 whitespace-normal align-top">
                          <Badge variant="secondary" className="max-w-full whitespace-normal rounded-full font-normal break-words">
                            {p.industry}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={p.stage}
                            onValueChange={(stage) => onPickStage(p, stage)}
                            disabled={patchStage.isPending || patchWonWithAmount.isPending}
                          >
                            <SelectTrigger className="h-9 w-full min-w-0 rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STUDIO_STAGES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {labelStage(s)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-0 whitespace-normal text-muted-foreground text-sm tabular-nums align-top">
                          {wonAmt}
                        </TableCell>
                        <TableCell className="min-w-0 whitespace-normal text-muted-foreground text-sm align-top break-words">
                          {labelAccountStatus(p.account_status)}
                        </TableCell>
                        <TableCell className="text-right align-top whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="rounded-lg"
                              aria-label={t("ariaLogInteraction")}
                              onClick={() => setActivityProspect(p)}
                            >
                              <MessageSquarePlus className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="rounded-lg"
                              aria-label={t("ariaEditAccount")}
                              onClick={() => {
                                setCreateOpen(false);
                                setEditProspect(p);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div
                className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-border bg-background/95 px-3 py-3 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between dark:shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.25)]"
              >
                <p className="text-muted-foreground text-sm">
                  {t("paginationSummary", {
                    from: (pipelinePage - 1) * PIPELINE_PAGE_SIZE + 1,
                    to: Math.min(pipelinePage * PIPELINE_PAGE_SIZE, filtered.length),
                    total: filtered.length,
                    pageSize: PIPELINE_PAGE_SIZE,
                  })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={pipelinePage <= 1}
                    onClick={() => {
                      setPipelinePage((pg) => Math.max(1, pg - 1));
                      pipelineTableScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <ChevronLeft className="mr-1 size-4" aria-hidden />
                    {t("previous")}
                  </Button>
                  <span className="text-muted-foreground px-1 text-sm tabular-nums">
                    {t("pageOf", { page: pipelinePage, pages: pipelineTotalPages })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={pipelinePage >= pipelineTotalPages}
                    onClick={() => {
                      setPipelinePage((pg) => Math.min(pipelineTotalPages, pg + 1));
                      pipelineTableScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {t("next")}
                    <ChevronRight className="ml-1 size-4" aria-hidden />
                  </Button>
                </div>
              </div>
              </div>
              {showTableScrollTop ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-4 bottom-20 z-30 size-10 rounded-full border border-border/80 bg-background/95 shadow-md backdrop-blur-sm"
                  aria-label={t("scrollTopAria")}
                  onClick={() => {
                    pipelineTableScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <ProspectFormDialog
        open={createOpen || editProspect != null}
        onOpenChange={(v) => {
          if (!v) {
            setCreateOpen(false);
            setEditProspect(null);
          }
        }}
        prospect={editProspect}
        userId={userId}
        role={role}
      />

      <PipelineWonAmountDialog
        open={wonFlow != null}
        onOpenChange={(v) => {
          if (!v) setWonFlow(null);
        }}
        businessName={wonFlow?.businessName ?? ""}
        initialStoredUsd={wonFlow?.initialStoredUsd ?? null}
        isPending={patchWonWithAmount.isPending}
        onConfirm={({ closed_deal_amount_stored_usd }) => {
          if (!wonFlow) return;
          patchWonWithAmount.mutate({
            id: wonFlow.id,
            closed_deal_amount: closed_deal_amount_stored_usd,
            customerName: wonFlow.businessName,
          });
        }}
      />

      <ActivityFormDialog
        open={activityProspect != null}
        onOpenChange={(v) => {
          if (!v) setActivityProspect(null);
        }}
        prospectId={activityProspect?.id ?? null}
        businessName={activityProspect?.business_name ?? ""}
      />

      <PipelineBulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} userId={userId} />

      <PipelineProspectDetailDialog
        prospect={detailProspect}
        onOpenChange={(v) => {
          if (!v) setDetailProspect(null);
        }}
        onEdit={(p) => {
          setCreateOpen(false);
          setEditProspect(p);
        }}
        showOwner={showAddedBy}
      />
    </div>
  );
}
