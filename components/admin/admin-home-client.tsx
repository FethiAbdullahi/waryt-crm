"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  LayoutDashboard,
  LineChart,
  MessageSquareWarning,
  Package,
  Receipt,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormatMoney } from "@/lib/display-currency-store";
import { useRoleLabel } from "@/hooks/use-role-label";
import { isSuperAdmin } from "@/lib/roles";
import type { Profile, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

/** Distinct from command console metrics so React Query cache shapes never collide. */
const metricsKey = ["admin", "metrics", "home"] as const;

type AdminLinkKey =
  | "orgSales"
  | "products"
  | "teamPerformance"
  | "commandConsole"
  | "pipeline"
  | "reports"
  | "challenges"
  | "dataWorkspace"
  | "people";

const linkDefs: Array<{
  href: string;
  key: AdminLinkKey;
  icon: LucideIcon;
  accent: string;
}> = [
  { href: "/admin/sales", key: "orgSales", icon: Receipt, accent: "from-primary/15 to-chart-2/12" },
  { href: "/admin/products", key: "products", icon: Package, accent: "from-chart-3/15 to-primary/10" },
  {
    href: "/admin/performance",
    key: "teamPerformance",
    icon: TrendingUp,
    accent: "from-chart-2/15 to-muted/25",
  },
  { href: "/settings?tab=command", key: "commandConsole", icon: Shield, accent: "from-primary/20 to-chart-2/15" },
  { href: "/sales?tab=pipeline", key: "pipeline", icon: LayoutDashboard, accent: "from-chart-2/15 to-primary/10" },
  { href: "/reports", key: "reports", icon: LineChart, accent: "from-muted/40 to-primary/8" },
  {
    href: "/sales?tab=field",
    key: "challenges",
    icon: MessageSquareWarning,
    accent: "from-primary/12 to-chart-2/10",
  },
  { href: "/sales?tab=reporting", key: "dataWorkspace", icon: BarChart3, accent: "from-card to-muted/30" },
  { href: "/people", key: "people", icon: Users, accent: "from-chart-2/12 to-muted/25" },
];

export function AdminHomeClient({ profile, userId }: { profile: Profile; userId: string }) {
  const t = useTranslations("admin");
  const { money } = useFormatMoney();
  const roleLabel = useRoleLabel();
  const role = profile.role as UserRole;

  const { data: metrics, isPending, isError } = useQuery({
    queryKey: metricsKey,
    queryFn: async () => {
      const [profiles, activeChallenges, prospects, salesRpc] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("challenges").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("studio_prospects").select("*", { count: "exact", head: true }),
        supabase.rpc("rpc_admin_sales_overview"),
      ]);
      if (profiles.error) throw profiles.error;
      if (activeChallenges.error) throw activeChallenges.error;
      if (prospects.error) throw prospects.error;
      if (salesRpc.error) throw salesRpc.error;
      const so = (salesRpc.data ?? {}) as Record<string, unknown>;
      return {
        people: profiles.count ?? 0,
        activeChallenges: activeChallenges.count ?? 0,
        prospects: prospects.count ?? 0,
        salesTotalAllTime: Number(so.total_all_time ?? 0),
        salesTotal7d: Number(so.total_7d ?? 0),
        salesEntries7d: Number(so.entries_7d ?? 0),
        salesEntriesAllTime: Number(so.entries_all_time ?? 0),
      };
    },
  });

  const salesHint = useMemo(() => {
    if (!metrics) return "";
    return t("snapshotSalesHint", {
      total7d: money(metrics.salesTotal7d),
      entriesAll: String(metrics.salesEntriesAllTime),
      entries7d: String(metrics.salesEntries7d),
    });
  }, [metrics, money, t]);

  return (
    <div className="relative mx-auto max-w-6xl space-y-10 pb-16">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl dark:bg-primary/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 top-40 h-64 w-64 rounded-full bg-chart-2/20 blur-3xl dark:bg-chart-2/12"
        aria-hidden
      />

      <header className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.09] p-6 shadow-xl shadow-primary/10 ring-1 ring-black/[0.04] dark:from-card dark:to-primary/15 dark:ring-white/10 sm:p-10 md:p-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Shield className="size-3.5" aria-hidden />
              {t("badge")}
            </div>
            <h1 className="font-heading text-foreground text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed sm:text-lg">
              {isSuperAdmin(role) ? t("subtitleSuper") : t("subtitleOrg")}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                {t("signedInPrefix")}{" "}
                <span className="text-foreground">{profile.display_name}</span>
              </span>
              <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                {roleLabel(role)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/settings?tab=command"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-12 rounded-2xl px-8 text-base font-semibold shadow-lg shadow-primary/25",
              )}
            >
              {t("openCommandConsole")}
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
            <Link
              href="/sales?tab=pipeline"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 rounded-2xl border-border/80 px-6 font-medium",
              )}
            >
              {t("browsePipeline")}
            </Link>
            <Link
              href="/admin/sales"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 rounded-2xl border-border/80 px-6 font-medium",
              )}
            >
              {t("orgSalesDesk")}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Zap className="text-primary size-5" aria-hidden />
          <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">{t("liveSnapshot")}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isPending ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40" />
            ))
          ) : isError ? (
            <p className="text-destructive col-span-full text-sm">{t("snapshotError")}</p>
          ) : metrics ? (
            <>
              <SnapshotTile
                label={t("snapshotPeople")}
                value={String(metrics.people)}
                hint={t("snapshotPeopleHint")}
                icon={Users}
                openCta={t("openArrow")}
              />
              <SnapshotTile
                label={t("snapshotChallenges")}
                value={String(metrics.activeChallenges)}
                hint={t("snapshotChallengesHint")}
                icon={MessageSquareWarning}
                openCta={t("openArrow")}
              />
              <SnapshotTile
                label={t("snapshotPipeline")}
                value={String(metrics.prospects ?? 0)}
                hint={t("snapshotPipelineHint")}
                icon={Target}
                href="/sales?tab=pipeline"
                openCta={t("openArrow")}
              />
              <SnapshotTile
                label={t("snapshotSales")}
                value={money(metrics.salesTotalAllTime)}
                hint={salesHint}
                icon={Sparkles}
                href="/admin/sales"
                openCta={t("openArrow")}
              />
            </>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-foreground px-1 text-xl font-bold tracking-tight">{t("shortcuts")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {linkDefs.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} prefetch className="group block">
                <Card
                  className={cn(
                    "h-full overflow-hidden rounded-2xl border-border/60 bg-gradient-to-br shadow-md transition-all duration-200",
                    "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10",
                    item.accent,
                  )}
                >
                  <CardHeader className="space-y-3 pb-2">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-background/90 text-primary shadow-sm ring-1 ring-border/50 dark:bg-background/70">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <CardTitle className="font-heading text-lg leading-tight">
                      {t(`links.${item.key}.title`)}
                    </CardTitle>
                    <CardDescription className="text-[13px] leading-relaxed">
                      {t(`links.${item.key}.desc`)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "group-hover:text-primary -ml-2 rounded-lg px-2 font-semibold",
                      )}
                    >
                      {t("go")}
                      <ArrowRight className="ml-1 size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <Card className="relative overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-r from-primary/[0.07] via-card to-chart-2/[0.06] shadow-md">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="space-y-1">
            <p className="text-primary text-xs font-bold uppercase tracking-wider">{t("proTip")}</p>
            <p className="font-heading text-foreground max-w-xl text-lg font-semibold">
              {t("supportBlurb", { id: userId.slice(0, 8) })}
            </p>
          </div>
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "secondary", size: "default" }), "shrink-0 rounded-xl")}
          >
            {t("openSettings")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function SnapshotTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  openCta,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  href?: string;
  openCta: string;
}) {
  const inner = (
    <div
      className={cn(
        "surface-elevated flex h-full flex-col gap-2 rounded-2xl border border-border/50 p-4 transition-colors",
        href && "group-hover:border-primary/35",
      )}
    >
      <div className="text-muted-foreground flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
        <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
      </div>
      <p className="font-heading text-foreground text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-muted-foreground text-xs">{hint}</p>
      {href ? <p className="text-primary text-xs font-medium group-hover:underline">{openCta}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch
        className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}
