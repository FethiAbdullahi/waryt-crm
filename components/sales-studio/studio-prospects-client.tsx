"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Factory,
  Layers,
  Pencil,
  Search,
  Shield,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  labelAccountStatus,
  labelStage,
  STUDIO_ACCOUNT_STATUS,
  STUDIO_STAGES,
} from "@/lib/sales-studio/routes";
import { studioProspectsQueryKey } from "@/lib/sales-studio/query-keys";
import type { StudioProspect, UserRole } from "@/lib/types";

const supabaseProspects = createBrowserSupabaseClient();

const INDEX_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as readonly string[];
const PREVIEW_PER_LETTER = 5;
const OTHER_LETTER_KEY = "#";
const LETTER_ORDER = [...INDEX_LETTERS, OTHER_LETTER_KEY] as const;

function businessFirstLetter(name: string): string {
  const t = name.trim();
  if (!t) return OTHER_LETTER_KEY;
  const ch = t[0]!.toUpperCase();
  if (ch >= "A" && ch <= "Z") return ch;
  return OTHER_LETTER_KEY;
}

function lettersWithProspects(byLetter: Record<string, StudioProspect[]>) {
  const out: string[] = [];
  for (const L of LETTER_ORDER) {
    if ((byLetter[L] ?? []).length > 0) out.push(L);
  }
  return out;
}

function prevLetterWithData(byLetter: Record<string, StudioProspect[]>, current: string): string | null {
  const keys = lettersWithProspects(byLetter);
  const i = keys.indexOf(current);
  if (i <= 0) return null;
  return keys[i - 1] ?? null;
}

function nextLetterWithData(byLetter: Record<string, StudioProspect[]>, current: string): string | null {
  const keys = lettersWithProspects(byLetter);
  const i = keys.indexOf(current);
  if (i < 0 || i >= keys.length - 1) return null;
  return keys[i + 1] ?? null;
}

function ProspectsLetterDirectory({
  sortedFiltered,
  onEdit,
  isSearchActive,
}: {
  sortedFiltered: StudioProspect[];
  onEdit: (p: StudioProspect) => void;
  /** When true, show every match in one list — letter tabs only apply with an empty search. */
  isSearchActive: boolean;
}) {
  const t = useTranslations("studioPanels.prospects");
  const [expanded, setExpanded] = useState(false);

  const byLetter = useMemo(() => {
    const buckets: Record<string, StudioProspect[]> = {};
    for (const c of INDEX_LETTERS) buckets[c] = [];
    buckets[OTHER_LETTER_KEY] = [];
    for (const p of sortedFiltered) {
      const L = businessFirstLetter(p.business_name);
      if (!buckets[L]) buckets[OTHER_LETTER_KEY].push(p);
      else buckets[L].push(p);
    }
    return buckets;
  }, [sortedFiltered]);

  const firstWithData = useMemo(() => {
    const keys = lettersWithProspects(byLetter);
    return keys[0] ?? "A";
  }, [byLetter]);

  const [activeLetter, setActiveLetter] = useState(firstWithData);

  const effectiveLetter =
    (byLetter[activeLetter] ?? []).length > 0 ? activeLetter : firstWithData;
  const letterBucketList = byLetter[effectiveLetter] ?? [];
  const list = isSearchActive ? sortedFiltered : letterBucketList;
  const title = isSearchActive
    ? t("searchResults")
    : effectiveLetter === OTHER_LETTER_KEY
      ? t("letterOtherTitle")
      : effectiveLetter;
  const visible = expanded ? list : list.slice(0, PREVIEW_PER_LETTER);
  const hasMore = list.length > PREVIEW_PER_LETTER;
  const prevL = prevLetterWithData(byLetter, effectiveLetter);
  const nextL = nextLetterWithData(byLetter, effectiveLetter);

  if (isSearchActive) {
    return (
      <div className="space-y-4">
        <section className="space-y-4" aria-labelledby="prospect-search-results-heading">
          <div className="flex flex-wrap items-baseline gap-2 border-b border-border/60 pb-2">
            <h2 id="prospect-search-results-heading" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <span className="text-muted-foreground text-sm">({list.length})</span>
          </div>
          <p className="text-muted-foreground text-sm">{t("searchMatchesHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((p) => (
              <ProspectSummaryCard key={p.id} p={p} onEdit={onEdit} />
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                aria-expanded={expanded}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? t("showFewer") : t("showAll", { count: list.length })}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <span className="text-muted-foreground shrink-0 text-xs font-medium uppercase tracking-wide">
          {t("browseByLetter")}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 shrink-0 rounded-lg"
            disabled={prevL == null}
            aria-label={t("prevLetter")}
            onClick={() => {
              if (prevL) {
                setActiveLetter(prevL);
                setExpanded(false);
              }
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5"
            role="tablist"
            aria-label={t("letterTablist")}
          >
            {LETTER_ORDER.map((L) => {
              const count = (byLetter[L] ?? []).length;
              const label = L === OTHER_LETTER_KEY ? "#" : L;
              const isActive = effectiveLetter === L;
              return (
                <Button
                  key={L}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={count === 0}
                  title={
                    count === 0
                      ? t("noCompaniesLetter")
                      : `${count} ${count === 1 ? t("company") : t("companies")}`
                  }
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="h-8 min-w-8 shrink-0 rounded-lg px-2 font-mono text-xs"
                  onClick={() => {
                    if (count === 0) return;
                    setActiveLetter(L);
                    setExpanded(false);
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 shrink-0 rounded-lg"
            disabled={nextL == null}
            aria-label={t("nextLetter")}
            onClick={() => {
              if (nextL) {
                setActiveLetter(nextL);
                setExpanded(false);
              }
            }}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <section className="space-y-4" aria-labelledby="prospect-active-letter-heading">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 id="prospect-active-letter-heading" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <span className="text-muted-foreground text-sm">({letterBucketList.length})</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <ProspectSummaryCard key={p.id} p={p} onEdit={onEdit} />
          ))}
        </div>
        {hasMore ? (
          <div className="flex justify-center pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded
                ? t("showFewerWithScope", { scope: title })
                : effectiveLetter === OTHER_LETTER_KEY
                  ? t("showAllInGroup", { count: letterBucketList.length })
                  : t("showAllForLetter", { letter: effectiveLetter, count: letterBucketList.length })}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProspectSummaryCard({
  p,
  onEdit,
}: {
  p: StudioProspect;
  onEdit: (p: StudioProspect) => void;
}) {
  const t = useTranslations("studioPanels.prospects");
  const stageKey = `stageOptions.${p.stage}`;
  const statusKey = `accountStatusOptions.${p.account_status}`;
  const stageText = t.has(stageKey) ? t(stageKey) : labelStage(p.stage);
  const statusText = t.has(statusKey) ? t(statusKey) : labelAccountStatus(p.account_status);
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-start gap-2">
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight">{p.business_name}</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {p.contact_name?.trim() ? p.contact_name.trim() : t("noContactName")}
            </p>
            {p.contact_email?.trim() ? (
              <p className="text-muted-foreground mt-0.5 text-xs break-all">{p.contact_email.trim()}</p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0 rounded-lg"
          aria-label={t("editProspectAria", { name: p.business_name })}
          onClick={() => onEdit(p)}
        >
          <Pencil className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          {p.team_name?.trim() ? (
            <Badge variant="outline" className="rounded-full border-primary/25 text-xs font-normal text-primary">
              {p.team_name.trim()}
            </Badge>
          ) : null}
          <Badge variant="outline" className="rounded-full">
            {p.industry}
          </Badge>
          <Badge variant="secondary" className="rounded-full">
            {t("companySizeStaff", { band: p.company_size_band })}
          </Badge>
        </div>
        <p>
          <span className="text-muted-foreground">{t("stageLabel")}</span>{" "}
          <span className="font-medium">{stageText}</span>
        </p>
        <p>
          <span className="text-muted-foreground">{t("statusLabel")}</span>{" "}
          <span className="font-medium">{statusText}</span>
        </p>
        {p.interested_modules ? (
          <p className="text-muted-foreground line-clamp-3">
            <span className="font-medium text-foreground">{t("featuresLabel")}</span> {p.interested_modules}
          </p>
        ) : null}
        {p.pain_points ? (
          <p className="text-muted-foreground line-clamp-3">
            <span className="font-medium text-foreground">{t("painLabel")}</span> {p.pain_points}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StudioProspectsClient({ userId, role }: { userId: string; role: UserRole }) {
  const t = useTranslations("studioPanels.prospects");
  const [edit, setEdit] = useState<StudioProspect | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<"all" | (typeof STUDIO_STAGES)[number]>("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState<
    "all" | (typeof STUDIO_ACCOUNT_STATUS)[number]
  >("all");

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: studioProspectsQueryKey(userId),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabaseProspects.from("studio_prospects").select("*, teams(name)").order("business_name");
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => {
        const tm = row.teams as { name?: string | null } | null;
        const team_name = tm?.name != null && String(tm.name).trim() !== "" ? String(tm.name).trim() : null;
        const { teams, ...r } = row;
        void teams;
        return { ...r, team_name } as StudioProspect;
      });
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

  const industryApplied =
    industryFilter !== "all" && industryOptions.includes(industryFilter) ? industryFilter : null;

  const filtersActive = useMemo(
    () =>
      nameQuery.trim() !== "" ||
      industryApplied != null ||
      stageFilter !== "all" ||
      accountStatusFilter !== "all",
    [nameQuery, industryApplied, stageFilter, accountStatusFilter],
  );

  const filtered = useMemo(() => {
    let list = prospects;
    if (industryApplied) list = list.filter((p) => p.industry === industryApplied);
    if (stageFilter !== "all") list = list.filter((p) => p.stage === stageFilter);
    if (accountStatusFilter !== "all") list = list.filter((p) => p.account_status === accountStatusFilter);
    const q = nameQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const biz = p.business_name.toLowerCase();
        const contact = (p.contact_name ?? "").toLowerCase();
        const email = (p.contact_email ?? "").toLowerCase();
        const modules = (p.interested_modules ?? "").toLowerCase();
        const pain = (p.pain_points ?? "").toLowerCase();
        return (
          biz.includes(q) ||
          contact.includes(q) ||
          email.includes(q) ||
          modules.includes(q) ||
          pain.includes(q)
        );
      });
    }
    return list;
  }, [prospects, industryApplied, stageFilter, accountStatusFilter, nameQuery]);

  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => a.business_name.localeCompare(b.business_name, undefined, { sensitivity: "base" })),
    [filtered],
  );

  const isSearchActive = nameQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{t("customersTitle")}</CardTitle>
              <Badge variant="secondary" className="rounded-full font-normal">
                {filtersActive ? t("matching", { count: filtered.length }) : t("total", { count: prospects.length })}
              </Badge>
            </div>
            <CardDescription>{t("customersDescription")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : prospects.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2 sm:p-2.5">
                <p className="sr-only">{t("filtersHint")}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <div className="relative min-h-9 min-w-0 flex-1">
                    <Label htmlFor="prospect-search" className="sr-only">
                      {t("searchCompaniesLabel")}
                    </Label>
                    <Search
                      className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="prospect-search"
                      className="h-8 w-208 rounded-md border-border/70 bg-background pr-3 pl-9 text-sm shadow-sm"
                      placeholder={t("searchPlaceholder")}
                      value={nameQuery}
                      onChange={(e) => setNameQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex min-w-0 flex-wrap items-stretch gap-2 sm:flex-nowrap sm:justify-end">
                    <Label htmlFor="prospect-industry" className="sr-only">
                      {t("industry")}
                    </Label>
                    <Select
                      value={industryApplied ?? "all"}
                      onValueChange={(v) => setIndustryFilter(v ?? "all")}
                    >
                      <SelectTrigger
                        id="prospect-industry"
                        className="h-9 min-w-64 flex-1 rounded-md border-border/70 bg-background text-sm shadow-sm sm:w-36 sm:flex-none md:w-40"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Factory className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                          <SelectValue placeholder={t("industry")} />
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
                    <Label htmlFor="prospect-stage" className="sr-only">
                      {t("stage")}
                    </Label>
                    <Select
                      value={stageFilter}
                      onValueChange={(v) => {
                        if (!v || v === "all") setStageFilter("all");
                        else setStageFilter(v as (typeof STUDIO_STAGES)[number]);
                      }}
                    >
                      <SelectTrigger
                        id="prospect-stage"
                        className="h-9 min-w-0 flex-1 rounded-md border-border/70 bg-background text-sm shadow-sm sm:w-32 sm:flex-none"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Layers className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                          <SelectValue placeholder={t("stage")} />
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
                    <Label htmlFor="prospect-status" className="sr-only">
                      {t("accountStatusFilterLabel")}
                    </Label>
                    <Select
                      value={accountStatusFilter}
                      onValueChange={(v) => {
                        if (!v || v === "all") setAccountStatusFilter("all");
                        else setAccountStatusFilter(v as (typeof STUDIO_ACCOUNT_STATUS)[number]);
                      }}
                    >
                      <SelectTrigger
                        id="prospect-status"
                        className="h-9 min-w-0 flex-1 rounded-md border-border/70 bg-background text-sm shadow-sm sm:w-36 sm:flex-none md:w-44"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Shield className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                          <SelectValue placeholder={t("status")} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allStatuses")}</SelectItem>
                        {STUDIO_ACCOUNT_STATUS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {labelAccountStatus(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 rounded-md px-3 text-muted-foreground"
                      disabled={!filtersActive}
                      onClick={() => {
                        setNameQuery("");
                        setIndustryFilter("all");
                        setStageFilter("all");
                        setAccountStatusFilter("all");
                      }}
                    >
                      {t("clearFilters")}
                    </Button>
                  </div>
                </div>
              </div>

              {filtered.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noMatch")}</p>
              ) : (
                <ProspectsLetterDirectory
                  key={`${industryFilter}\t${stageFilter}\t${accountStatusFilter}\t${isSearchActive ? "search" : "browse"}`}
                  sortedFiltered={sortedFiltered}
                  onEdit={setEdit}
                  isSearchActive={isSearchActive}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ProspectFormDialog
        open={edit != null}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
        prospect={edit}
        userId={userId}
        role={role}
      />
    </div>
  );
}
