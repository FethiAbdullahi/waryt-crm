"use client";

import { startTransition, useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { SalesPageClient } from "@/components/sales/sales-page-client";
import {
  SALES_STUDIO_NAV,
  parseSalesStudioTab,
  salesStudioHref,
  type SalesStudioNavItem,
  type SalesStudioTabId,
} from "@/lib/sales-studio/routes";
import { SalesStudioNavProvider } from "@/lib/sales-studio/sales-studio-nav-context";
import { canAccessManagerRoutes } from "@/lib/roles";
import type { Profile, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StudioAlertsClient } from "@/components/sales-studio/studio-alerts-client";
import { StudioInteractionsClient } from "@/components/sales-studio/studio-interactions-client";
import { StudioInsightsClient } from "@/components/sales-studio/studio-insights-client";
import { StudioOverviewClient } from "@/components/sales-studio/studio-overview-client";
import { StudioPerformanceClient } from "@/components/sales-studio/studio-performance-client";
import { StudioPipelineClient } from "@/components/sales-studio/studio-pipeline-client";
import { StudioProspectsClient } from "@/components/sales-studio/studio-prospects-client";
import { ContextualHint } from "@/components/onboarding/contextual-hint";
import { StudioReportingClient } from "@/components/sales-studio/studio-reporting-client";
import { ChallengesPageClient } from "@/components/challenges/challenges-page-client";

function StudioTabButton({
  item,
  active,
  onSelect,
  tTabs,
}: {
  item: SalesStudioNavItem;
  active: boolean;
  onSelect: () => void;
  /** Must use static namespace `studioWorkspace.tabs` — dynamic `useTranslations(\`…${tab}\`)` is not reliable in next-intl. */
  tTabs: ReturnType<typeof useTranslations<"studioWorkspace.tabs">>;
}) {
  const Icon = item.icon;
  const labelKey = `${item.tab}.label` as Parameters<typeof tTabs>[0];
  const descKey = `${item.tab}.description` as Parameters<typeof tTabs>[0];
  return (
    <button
      type="button"
      title={tTabs(descKey)}
      onClick={onSelect}
      className={cn(
        "inline-flex snap-start items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
        active
          ? "bg-primary/12 text-primary ring-1 ring-primary/20"
          : "text-muted-foreground hover:bg-background hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
      {tTabs(labelKey)}
    </button>
  );
}

function StudioTabPanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(active);
  if (active && !mounted) {
    setMounted(true);
  }
  if (!mounted) return null;
  return (
    <div role="tabpanel" aria-hidden={!active} className={active ? "min-h-0" : "hidden"}>
      {children}
    </div>
  );
}

export function SalesStudioWorkspace({
  userId,
  profile,
  initialTab,
}: {
  userId: string;
  profile: Profile | null;
  initialTab: SalesStudioTabId;
}) {
  const t = useTranslations("studioWorkspace");
  const tTabs = useTranslations("studioWorkspace.tabs");
  const [tab, setTab] = useState<SalesStudioTabId>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setTab(initialTab);
  }

  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      setTab(parseSalesStudioTab(sp.get("tab")));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goTab = useCallback((next: SalesStudioTabId) => {
    startTransition(() => {
      setTab(next);
      window.history.replaceState(null, "", salesStudioHref(next));
    });
  }, []);

  const role = (profile?.role ?? "agent") as UserRole;

  return (
    <SalesStudioNavProvider value={{ tab, goTab }}>
      <div className="space-y-6 sm:space-y-8">
        <header className="space-y-1">
          <p className="text-primary text-xs font-semibold uppercase tracking-wider">{t("brand")}</p>
          <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-4xl text-base sm:text-lg">
            {canAccessManagerRoutes(role) ? t("subtitleManager") : t("subtitleRep")}
          </p>
        </header>

        {tab === "overview" ? <ContextualHint hintId="salesStudioOverview" /> : null}

        <div className="border-border/60 bg-muted/30 w-full overflow-x-auto rounded-2xl border py-2">
          <nav
            className="flex min-w-max snap-x snap-mandatory gap-1 px-2 pb-1 sm:flex-wrap sm:snap-none sm:gap-1.5 sm:px-3 sm:pb-0"
            aria-label={t("navAria")}
          >
            {SALES_STUDIO_NAV.map((item) => (
              <StudioTabButton
                key={item.tab}
                tTabs={tTabs}
                item={item}
                active={tab === item.tab}
                onSelect={() => goTab(item.tab)}
              />
            ))}
          </nav>
        </div>

        <StudioTabPanel active={tab === "overview"}>
          <StudioOverviewClient userId={userId} />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "interactions"}>
          <StudioInteractionsClient userId={userId} role={role} />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "pipeline"}>
          <StudioPipelineClient userId={userId} role={role} />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "prospects"}>
          <StudioProspectsClient userId={userId} role={role} />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "performance"}>
          <StudioPerformanceClient userId={userId} />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "insights"}>
          <StudioInsightsClient />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "alerts"}>
          <StudioAlertsClient userId={userId} />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "reporting"}>
          <StudioReportingClient userId={userId} role={role} />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "log"}>
          <SalesPageClient profile={profile} userId={userId} />
        </StudioTabPanel>
        <StudioTabPanel active={tab === "field"}>
          <ChallengesPageClient profile={profile} userId={userId} />
        </StudioTabPanel>
      </div>
    </SalesStudioNavProvider>
  );
}
