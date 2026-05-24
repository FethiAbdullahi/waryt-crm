"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowRight,
  DollarSign,
  Layers,
  MessageSquareWarning,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDisplayCurrencyStore, useFormatMoney } from "@/lib/display-currency-store";
import { formatCurrency } from "@/lib/format";
import { useRoleLabel } from "@/hooks/use-role-label";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LEAD_INDUSTRIES } from "@/lib/sales-studio/routes";
import type { Profile, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

const ASSIGNABLE_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "agent",
];

const qk = {
  /** Distinct from admin home snapshot — different payload (no pipeline / teams counts). */
  metrics: ["admin", "metrics", "console"] as const,
  people: ["admin", "people"] as const,
  activity: ["admin", "activity"] as const,
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type ActivityRow =
  | {
      kind: "sale";
      id: string;
      at: string;
      title: string;
      subtitle: string;
    }
  | {
      kind: "challenge";
      id: string;
      at: string;
      title: string;
      subtitle: string;
    }
  | {
      kind: "signup";
      id: string;
      at: string;
      title: string;
      subtitle: string;
    };

export function AdminConsoleClient({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const { money } = useFormatMoney();
  const roleLabel = useRoleLabel();
  const tRoles = useTranslations("roles");
  const currency = useDisplayCurrencyStore((s) => s.currency);
  const [activityWindowDays, setActivityWindowDays] = useState(14);
  const [activityKind, setActivityKind] = useState<"all" | "sale" | "challenge" | "signup">("all");

  const metricsQuery = useQuery({
    queryKey: qk.metrics,
    queryFn: async () => {
      const [profiles, activeChallenges, salesRpc] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("challenges")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.rpc("rpc_admin_sales_overview"),
      ]);

      if (profiles.error) throw profiles.error;
      if (activeChallenges.error) throw activeChallenges.error;
      if (salesRpc.error) throw salesRpc.error;

      const so = (salesRpc.data ?? {}) as Record<string, unknown>;

      return {
        people: profiles.count ?? 0,
        activeChallenges: activeChallenges.count ?? 0,
        salesTotalAllTime: Number(so.total_all_time ?? 0),
        salesTotal7d: Number(so.total_7d ?? 0),
        salesEntries7d: Number(so.entries_7d ?? 0),
      };
    },
  });

  const peopleQuery = useQuery({
    queryKey: qk.people,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, role, avatar_url, created_at")
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<
        Profile,
        "id" | "display_name" | "role" | "avatar_url" | "created_at"
      >[];
    },
  });

  const activityQuery = useQuery({
    queryKey: [...qk.activity, activityWindowDays, activityKind, currency] as const,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - activityWindowDays);
      const sinceIso = since.toISOString();

      const wantSales = activityKind === "all" || activityKind === "sale";
      const wantChallenges = activityKind === "all" || activityKind === "challenge";
      const wantSignups = activityKind === "all" || activityKind === "signup";

      const [salesRes, challengesRes, signupsRes] = await Promise.all([
        wantSales
          ? supabase
              .from("sales_entries")
              .select("id, amount, created_at, customer_name, user_id, industry")
              .gte("created_at", sinceIso)
              .order("created_at", { ascending: false })
              .limit(80)
          : Promise.resolve({ data: [] as const, error: null }),
        wantChallenges
          ? supabase
              .from("challenges")
              .select("id, title, status, created_at")
              .gte("created_at", sinceIso)
              .order("created_at", { ascending: false })
              .limit(40)
          : Promise.resolve({ data: [] as const, error: null }),
        wantSignups
          ? supabase
              .from("profiles")
              .select("id, display_name, role, created_at")
              .gte("created_at", sinceIso)
              .order("created_at", { ascending: false })
              .limit(40)
          : Promise.resolve({ data: [] as const, error: null }),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (challengesRes.error) throw challengesRes.error;
      if (signupsRes.error) throw signupsRes.error;

      const userIds = [
        ...new Set((salesRes.data ?? []).map((s) => s.user_id).filter(Boolean)),
      ] as string[];

      let nameByUser = new Map<string, string>();
      if (userIds.length) {
        const { data: profs, error: pe } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        if (pe) throw pe;
        nameByUser = new Map(
          (profs ?? []).map((p) => [p.id, p.display_name] as const),
        );
      }

      const rows: ActivityRow[] = [];

      for (const s of salesRes.data ?? []) {
        const who = nameByUser.get(s.user_id) ?? "Member";
        const ind = (s as { industry?: string }).industry;
        rows.push({
          kind: "sale",
          id: `sale:${s.id}`,
          at: s.created_at,
          title: `${who} logged ${formatCurrency(Number(s.amount), currency)}`,
          subtitle: [
            ind ? `Industry: ${ind}` : null,
            s.customer_name ? `Customer: ${s.customer_name}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Sales desk",
        });
      }

      for (const c of challengesRes.data ?? []) {
        rows.push({
          kind: "challenge",
          id: `challenge:${c.id}`,
          at: c.created_at,
          title: `Challenge “${c.title}”`,
          subtitle: `Status: ${c.status}`,
        });
      }

      for (const p of signupsRes.data ?? []) {
        rows.push({
          kind: "signup",
          id: `signup:${p.id}`,
          at: p.created_at,
          title: `${p.display_name} joined`,
          subtitle: `${tRoles("roleLabel")}: ${roleLabel(p.role as UserRole)}`,
        });
      }

      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 96);
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      void qc.invalidateQueries({ queryKey: qk.people });
      void qc.invalidateQueries({ queryKey: qk.activity });
      void qc.invalidateQueries({ queryKey: qk.metrics });
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not update role"),
  });

  const activityByDay = useMemo(() => {
    const list = activityQuery.data ?? [];
    const map = new Map<string, number>();
    for (const r of list) {
      const day = r.at.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return map;
  }, [activityQuery.data]);

  const recentDaysLabel = useMemo(() => {
    const keys = [...activityByDay.keys()].sort((a, b) => (a < b ? 1 : -1));
    if (!keys.length) return null;
    const top = keys.slice(0, 3);
    const total = top.reduce((a, d) => a + (activityByDay.get(d) ?? 0), 0);
    return `${total} events in the last few active days`;
  }, [activityByDay]);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Command"
        description="Org-wide visibility, people, industry reference for Waryt Furniture sales, and recent activity. Only super admins see this space."
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="surface-muted h-auto w-full flex-wrap justify-start gap-1 p-1.5 sm:w-auto">
          <TabsTrigger className="rounded-xl px-4 py-2" value="overview">
            Overview
          </TabsTrigger>
          <TabsTrigger className="rounded-xl px-4 py-2" value="people">
            People
          </TabsTrigger>
          <TabsTrigger className="rounded-xl px-4 py-2" value="industries">
            Industries
          </TabsTrigger>
          <TabsTrigger className="rounded-xl px-4 py-2" value="activity">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 outline-none">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricsQuery.isPending ? (
              <>
                <div className="surface-elevated h-[128px] animate-pulse bg-muted/25" />
                <div className="surface-elevated h-[128px] animate-pulse bg-muted/25" />
                <div className="surface-elevated h-[128px] animate-pulse bg-muted/25" />
              </>
            ) : metricsQuery.isError ? (
              <p className="text-destructive text-sm col-span-full">
                Could not load metrics.
              </p>
            ) : metricsQuery.isSuccess ? (
              <>
                <StatCard
                  label="People"
                  value={String(metricsQuery.data.people)}
                  hint="Profiles in the workspace"
                  icon={Users}
                />
                <StatCard
                  label="Active challenges"
                  value={String(metricsQuery.data.activeChallenges)}
                  hint="Entries in flight"
                  icon={MessageSquareWarning}
                />
                <StatCard
                  label="Team sales (org)"
                  value={money(metricsQuery.data.salesTotalAllTime)}
                  hint={`${money(metricsQuery.data.salesTotal7d)} last 7d · ${metricsQuery.data.salesEntries7d} entries`}
                  icon={DollarSign}
                />
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/sales" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}>
              Organization sales
            </Link>
            <Link href="/admin/performance" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}>
              Team performance
            </Link>
            <Link href="/sales?tab=pipeline" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}>
              Waryt Studio pipeline
            </Link>
          </div>

          <div className="surface-elevated p-6 md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Pulse
                </h2>
                <p className="text-muted-foreground text-sm">
                  {recentDaysLabel ??
                    "Activity will appear as your teams use the hub."}
                </p>
              </div>
              <Badge variant="secondary" className="w-fit rounded-lg font-normal">
                <Sparkles className="mr-1 size-3" aria-hidden />
                Live data
              </Badge>
            </div>
            <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
              <div className="surface-muted rounded-xl p-4">
                <div className="text-muted-foreground text-xs font-medium uppercase">
                  Tip
                </div>
                <p className="mt-2 leading-relaxed">
                  Use{" "}
                  <span className="font-medium text-foreground">People</span> and{" "}
                  <span className="font-medium text-foreground">Industries</span> to keep the field aligned
                  with pipeline tags; role changes respect database rules.
                </p>
              </div>
              <div className="surface-muted rounded-xl p-4">
                <div className="text-muted-foreground text-xs font-medium uppercase">
                  Activity
                </div>
                <p className="mt-2 leading-relaxed">
                  The feed merges sales, challenges, and new profiles—best-effort
                  without a separate audit log.
                </p>
              </div>
              <div className="surface-muted rounded-xl p-4">
                <div className="text-muted-foreground text-xs font-medium uppercase">
                  Keyboard
                </div>
                <p className="mt-2 leading-relaxed">
                  Press{" "}
                  <kbd className="bg-background rounded border px-1.5 py-0.5 font-mono text-xs">
                    ⌘K
                  </kbd>{" "}
                  from anywhere to jump quickly.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="people" className="space-y-4 outline-none">
          <div className="surface-elevated overflow-hidden">
            <div className="border-b px-5 py-4 md:px-6">
              <h2 className="text-lg font-semibold tracking-tight">People</h2>
              <p className="text-muted-foreground text-sm">
                Names and roles from profiles. User IDs help support lookups.
              </p>
            </div>
            {peopleQuery.isPending ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-muted/30"
                  />
                ))}
              </div>
            ) : peopleQuery.isError ? (
              <p className="text-destructive p-5 text-sm">Could not load people.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 md:pl-6">Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Joined</TableHead>
                    <TableHead className="hidden lg:table-cell pr-5 md:pr-6">
                      User ID
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(peopleQuery.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-5 md:pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar size="sm">
                            {p.avatar_url ? (
                              <AvatarImage src={p.avatar_url} alt="" />
                            ) : null}
                            <AvatarFallback className="text-[10px]">
                              {initials(p.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="max-w-[160px] truncate font-medium md:max-w-[220px]">
                                {p.display_name}
                              </span>
                              {p.id === currentUserId ? (
                                <Badge
                                  variant="outline"
                                  className="rounded-md text-[10px] font-normal"
                                >
                                  You
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-muted-foreground font-mono text-[11px] md:hidden">
                              {p.id.slice(0, 8)}…
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.role}
                          disabled={updateRole.isPending}
                          onValueChange={(v) => {
                            const next = v as UserRole;
                            if (next === p.role) return;
                            updateRole.mutate({ id: p.id, role: next });
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            className="h-9 w-[160px] rounded-xl border bg-background"
                            aria-label={`Role for ${p.display_name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {ASSIGNABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="rounded-lg">
                                {roleLabel(r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                        }).format(new Date(p.created_at))}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell pr-5 md:pr-6">
                        {p.id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="industries" className="space-y-4 outline-none">
          <div className="surface-elevated overflow-hidden">
            <div className="border-b px-5 py-4 md:px-6">
              <h2 className="text-lg font-semibold tracking-tight">Industries</h2>
              <p className="text-muted-foreground text-sm">
                Waryt teams sell furniture and tagged offerings together—reps tag each sale by customer industry. These values
                match Waryt Studio prospects and the sales desk; they are enforced in the database, not
                edited here.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 md:pl-6">Industry</TableHead>
                  <TableHead className="pr-5 md:pr-6">How it is used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {LEAD_INDUSTRIES.map((name) => (
                  <TableRow key={name}>
                    <TableCell className="pl-5 md:pl-6">
                      <div className="flex items-center gap-2 font-medium">
                        <Layers className="text-muted-foreground size-4 shrink-0" aria-hidden />
                        <span>{name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground pr-5 text-sm md:pr-6">
                      Quick Add, Sales log, reports, and pipeline use this label for segmentation.
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 outline-none">
          <div className="surface-elevated space-y-4 p-5 md:p-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
              <p className="text-muted-foreground text-sm">
                Choose how far back to look and which events to show. Everything merges newest first.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="activity-window">Time window</Label>
                <Select
                  value={String(activityWindowDays)}
                  onValueChange={(v) => {
                    if (!v) return;
                    setActivityWindowDays(Number(v));
                  }}
                >
                  <SelectTrigger id="activity-window" className="w-full min-w-[11rem] rounded-xl sm:w-48">
                    <SelectValue placeholder="Window" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="60">Last 60 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-kind">Show</Label>
                <Select
                  value={activityKind}
                  onValueChange={(v) => {
                    if (!v) return;
                    setActivityKind(v as typeof activityKind);
                  }}
                >
                  <SelectTrigger id="activity-kind" className="w-full min-w-[11rem] rounded-xl sm:w-48">
                    <SelectValue placeholder="Events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All events</SelectItem>
                    <SelectItem value="sale">Sales only</SelectItem>
                    <SelectItem value="challenge">Challenges only</SelectItem>
                    <SelectItem value="signup">New people only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {activityQuery.isPending ? (
            <div className="surface-elevated space-y-3 p-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-muted/25"
                />
              ))}
            </div>
          ) : activityQuery.isError ? (
            <p className="text-destructive text-sm">Could not load activity.</p>
          ) : (activityQuery.data?.length ?? 0) === 0 ? (
            <div className="surface-muted text-muted-foreground rounded-2xl px-6 py-12 text-center text-sm">
              No events in this window yet.
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Activity feed">
              {activityQuery.data!.map((row) => (
                <li key={row.id}>
                  <div
                    className={cn(
                      "surface-elevated flex gap-4 p-4 transition-shadow duration-200",
                      "hover:shadow-md motion-reduce:transition-none",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                        row.kind === "sale" && "bg-primary/10 text-primary",
                        row.kind === "challenge" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                        row.kind === "signup" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      )}
                      aria-hidden
                    >
                      {row.kind === "sale" ? (
                        <DollarSign className="size-4" />
                      ) : row.kind === "challenge" ? (
                        <MessageSquareWarning className="size-4" />
                      ) : (
                        <UserPlus className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-medium leading-snug">{row.title}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatDistanceToNow(new Date(row.at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                        {row.subtitle}
                      </p>
                    </div>
                    <ArrowRight
                      className="text-muted-foreground mt-1 hidden size-4 shrink-0 md:block opacity-40"
                      aria-hidden
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Activity className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span>
          Super-admin tools are server-guarded; this UI mirrors what your account
          can read under RLS.
        </span>
      </div>
    </div>
  );
}
