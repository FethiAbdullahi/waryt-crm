"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  MessageSquareWarning,
  Shield,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SalesDeskTargetCard } from "@/components/sales/sales-desk-target-card";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRoleLabel } from "@/hooks/use-role-label";
import { isOrgAdmin } from "@/lib/roles";
import { useDisplayCurrencyStore } from "@/lib/display-currency-store";
import type { DisplayCurrencyCode } from "@/lib/format";
import { formatCurrency } from "@/lib/format";
import { entryAmountToStoredEtb, storedEtbToDisplayAmount } from "@/lib/sales-amount-entry";
import type { Profile, Target, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

function CommandConsoleLoadingState() {
  const t = useTranslations("settings");
  return (
    <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent px-6 py-16">
      <div className="border-primary/30 border-t-primary size-10 animate-spin rounded-full border-2" />
      <p className="text-muted-foreground text-center text-sm font-medium">{t("commandConsoleLoading")}</p>
    </div>
  );
}

const AdminConsoleLazy = dynamic(
  () =>
    import("@/components/admin/admin-console-client").then((mod) => ({
      default: mod.AdminConsoleClient,
    })),
  {
    ssr: false,
    loading: () => <CommandConsoleLoadingState />,
  },
);

type Prefs = {
  sales?: boolean;
  challenges?: boolean;
  digest?: boolean;
  display_currency?: DisplayCurrencyCode;
};

function readPrefs(profile: Profile | null): Required<Omit<Prefs, "display_currency">> & {
  display_currency: DisplayCurrencyCode;
} {
  const raw = profile?.notification_prefs;
  const defaults = {
    sales: true,
    challenges: true,
    digest: true,
    display_currency: "ETB" as DisplayCurrencyCode,
  };
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;
  const dc = "ETB" as const;
  return {
    sales: Boolean(o.sales ?? defaults.sales),
    challenges: Boolean(o.challenges ?? defaults.challenges),
    digest: Boolean(o.digest ?? defaults.digest),
    display_currency: dc,
  };
}

function mergeNotificationPrefs(
  profile: Profile | null,
  next: {
    sales: boolean;
    challenges: boolean;
    digest: boolean;
    display_currency: DisplayCurrencyCode;
  },
): Record<string, unknown> {
  const base =
    profile?.notification_prefs && typeof profile.notification_prefs === "object"
      ? { ...(profile.notification_prefs as Record<string, unknown>) }
      : {};
  return {
    ...base,
    sales: next.sales,
    challenges: next.challenges,
    digest: next.digest,
    display_currency: next.display_currency,
  };
}

function displayInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SettingsPageClient({
  profile,
  userId,
  initialTab,
}: {
  profile: Profile | null;
  userId: string;
  initialTab: "profile" | "command";
}) {
  const t = useTranslations("settings");
  const tToastSettings = useTranslations("toasts.settings");
  const tToastTargets = useTranslations("toasts.targets");
  const role = (profile?.role ?? "agent") as UserRole;
  const labelRole = useRoleLabel();
  const canSetTargetsForOthers = isOrgAdmin(role) || role === "manager";
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<"profile" | "command">(() => initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setTab(initialTab);
  }

  /** Updates the URL without a Next.js navigation — avoids RSC refetch / “Rendering…” stalls. */
  function setTabAndUrl(next: "profile" | "command") {
    setTab(next);
    const path = next === "command" ? "/settings?tab=command" : "/settings";
    window.history.replaceState(null, "", path);
  }

  const [name, setName] = useState(() => profile?.display_name ?? "");

  const initialPrefs = readPrefs(profile);
  const [sales, setSales] = useState(() => Boolean(initialPrefs.sales));
  const [challenges, setChallenges] = useState(() => Boolean(initialPrefs.challenges));
  const [digest, setDigest] = useState(() => Boolean(initialPrefs.digest));

  const profileSyncKey = useMemo(
    () =>
      JSON.stringify({
        display_name: profile?.display_name,
        notification_prefs: profile?.notification_prefs ?? null,
      }),
    [profile?.display_name, profile?.notification_prefs],
  );

  const [prevProfileSyncKey, setPrevProfileSyncKey] = useState(profileSyncKey);
  if (profileSyncKey !== prevProfileSyncKey) {
    setPrevProfileSyncKey(profileSyncKey);
    const p = readPrefs(profile);
    setSales(p.sales);
    setChallenges(p.challenges);
    setDigest(p.digest);
    setName(profile?.display_name ?? "");
  }

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name.trim(),
          notification_prefs: mergeNotificationPrefs(profile, {
            sales,
            challenges,
            digest,
            display_currency: "ETB",
          }),
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(tToastSettings("saved"));
      useDisplayCurrencyStore.getState().setCurrency("ETB");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: targets = [] } = useQuery({
    queryKey: ["targets", userId, role],
    enabled: canSetTargetsForOthers && tab === "command",
    queryFn: async () => {
      const { data, error } = await supabase.from("targets").select("*").order("starts_on", {
        ascending: false,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [targetDialog, setTargetDialog] = useState<null | { type: "create" } | { type: "edit"; id: string }>(
    null,
  );
  const [tUser, setTUser] = useState(userId);
  const [tPeriod, setTPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [tStarts, setTStarts] = useState("");
  const [tEnds, setTEnds] = useState("");
  const [tAmount, setTAmount] = useState("");

  const targetDialogOpen = targetDialog !== null;

  const { data: people = [] } = useQuery({
    queryKey: ["profiles", "pick"],
    enabled: targetDialogOpen && canSetTargetsForOthers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,role")
        .order("display_name", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pickUserId = useMemo(() => {
    if (!canSetTargetsForOthers) return userId;
    if (people.length === 0) return tUser;
    return people.some((p) => p.id === tUser) ? tUser : (people[0]?.id ?? userId);
  }, [canSetTargetsForOthers, people, tUser, userId]);

  const createTarget = useMutation({
    mutationFn: async () => {
      const amt = Number(tAmount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error(t("invalidTargetAmount"));
      const stored = entryAmountToStoredEtb(amt);
      const { error } = await supabase.from("targets").insert({
        scope: "user",
        user_id: pickUserId,
        team_id: null,
        period: tPeriod,
        starts_on: tStarts,
        ends_on: tEnds,
        amount: stored,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(tToastTargets("created"));
      setTargetDialog(null);
      setTAmount("");
      await queryClient.invalidateQueries({ queryKey: ["targets"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTarget = useMutation({
    mutationFn: async (id: string) => {
      const amt = Number(tAmount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error(t("invalidTargetAmount"));
      const stored = entryAmountToStoredEtb(amt);
      const { error } = await supabase
        .from("targets")
        .update({
          period: tPeriod,
          starts_on: tStarts,
          ends_on: tEnds,
          amount: stored,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(tToastTargets("updated"));
      setTargetDialog(null);
      await queryClient.invalidateQueries({ queryKey: ["targets"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTarget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("targets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(tToastTargets("removed"));
      setTargetDialog(null);
      await queryClient.invalidateQueries({ queryKey: ["targets"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNewTargetDialog() {
    setTUser(userId);
    setTPeriod("monthly");
    setTStarts("");
    setTEnds("");
    setTAmount("");
    setTargetDialog({ type: "create" });
  }

  function openEditTargetDialog(t: Target) {
    setTUser(t.user_id ?? userId);
    setTPeriod(t.period);
    setTStarts(t.starts_on);
    setTEnds(t.ends_on);
    setTAmount(String(storedEtbToDisplayAmount(Number(t.amount))));
    setTargetDialog({ type: "edit", id: t.id });
  }

  const roleLabelText = labelRole(role);
  const displayName = name.trim() || profile?.display_name || t("yourName");

  return (
    <div className="relative w-full max-w-none pb-16">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl dark:bg-primary/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-chart-2/20 blur-3xl dark:bg-chart-2/10"
        aria-hidden
      />

      <header className="relative mb-8 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.07] p-5 shadow-lg shadow-primary/5 ring-1 ring-black/[0.03] dark:from-card dark:to-primary/10 dark:ring-white/10 sm:mb-10 sm:rounded-[2rem] sm:p-8 md:p-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden />
              {t("workspaceBadge")}
            </div>
            <div>
              <h1 className="font-heading text-foreground text-4xl font-bold tracking-tight md:text-5xl">
                {t("title")}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-lg text-base leading-relaxed">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
                {roleLabelText}
              </Badge>
              {isOrgAdmin(role) ? (
                <Badge className="rounded-full bg-gradient-to-r from-primary to-chart-2 px-3 py-1 font-medium text-white shadow-sm">
                  <Shield className="mr-1 inline size-3" aria-hidden />
                  {t("commandAccess")}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-border/50 bg-background/80 px-5 py-4 shadow-sm backdrop-blur-sm dark:bg-background/40">
            <Avatar className="size-16 border-2 border-primary/20 shadow-md">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt="" />
              ) : null}
              <AvatarFallback className="font-heading bg-gradient-to-br from-primary/20 to-chart-2/20 text-lg font-bold text-primary">
                {displayInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{displayName}</p>
              <p className="text-muted-foreground text-sm">{t("signedInHint")}</p>
            </div>
          </div>
        </div>
      </header>

      <div
        className="relative mb-10 inline-flex w-full flex-col gap-2 rounded-2xl border border-border/60 bg-muted/30 p-1.5 shadow-inner sm:w-auto sm:flex-row"
        role="tablist"
        aria-label={t("tabsAria")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "profile"}
          onClick={() => setTabAndUrl("profile")}
          className={cn(
            "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all sm:flex-initial sm:justify-start",
            tab === "profile"
              ? "bg-background text-foreground shadow-md ring-1 ring-border/60"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          <UserRound className="size-4 shrink-0 opacity-80" aria-hidden />
          {t("tabProfile")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "command"}
          onClick={() => setTabAndUrl("command")}
          className={cn(
            "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all sm:flex-initial sm:justify-start",
            tab === "command"
              ? "bg-background text-foreground shadow-md ring-1 ring-border/60"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
          {t("tabCommand")}
        </button>
      </div>

      {tab === "profile" ? (
        <div className="relative grid gap-6 md:grid-cols-2">
          <Card className="overflow-hidden rounded-3xl border-border/60 shadow-md">
            <CardHeader className="border-b border-border/40 bg-gradient-to-r from-muted/40 to-transparent pb-4">
              <div className="flex items-center gap-2">
                <span className="bg-primary/15 text-primary flex size-9 items-center justify-center rounded-xl">
                  <UserRound className="size-4" aria-hidden />
                </span>
                <div>
                  <CardTitle className="font-heading text-xl">{t("identityTitle")}</CardTitle>
                  <CardDescription>{t("identityDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="dn" className="text-foreground/90">
                  {t("displayName")}
                </Label>
                <Input
                  id="dn"
                  className="h-11 rounded-xl border-border/80 text-base shadow-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("displayNamePlaceholder")}
                />
              </div>
              <Button
                className="h-11 w-full rounded-xl font-semibold shadow-sm sm:w-auto"
                disabled={saveProfile.isPending || !name.trim()}
                onClick={() => saveProfile.mutate()}
              >
                {saveProfile.isPending ? t("saving") : t("saveProfile")}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-border/60 shadow-md">
            <CardHeader className="border-b border-border/40 bg-gradient-to-r from-chart-2/10 to-transparent pb-4">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2">
                  <Bell className="size-4" aria-hidden />
                </span>
                <div>
                  <CardTitle className="font-heading text-xl">{t("notificationsTitle")}</CardTitle>
                  <CardDescription>{t("notificationsDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3.5 transition-colors hover:bg-muted/35">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Zap className="text-primary size-4 shrink-0" aria-hidden />
                    {t("notifSales")}
                  </div>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {t("notifSalesDesc")}
                  </p>
                </div>
                <Switch checked={sales} onCheckedChange={setSales} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3.5 transition-colors hover:bg-muted/35">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquareWarning className="size-4 shrink-0 text-chart-2" aria-hidden />
                    {t("notifChallenges")}
                  </div>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {t("notifChallengesDesc")}
                  </p>
                </div>
                <Switch checked={challenges} onCheckedChange={setChallenges} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3.5 transition-colors hover:bg-muted/35">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    {t("notifDigest")}
                  </div>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {t("notifDigestDesc")}
                  </p>
                </div>
                <Switch checked={digest} onCheckedChange={setDigest} />
              </div>

              <Separator className="my-2 bg-border/60" />

              <Button
                variant="secondary"
                className="h-11 w-full rounded-xl font-semibold sm:w-auto"
                disabled={saveProfile.isPending || !name.trim()}
                onClick={() => saveProfile.mutate()}
              >
                {saveProfile.isPending ? t("saving") : t("saveNotificationPrefs")}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "command" ? (
        <div className="relative space-y-8">
          {isOrgAdmin(role) ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Shield className="text-primary size-5" aria-hidden />
                <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">
                  {t("commandConsoleTitle")}
                </h2>
              </div>
              <p className="text-muted-foreground max-w-2xl px-1 text-sm leading-relaxed">
                {t("commandConsoleIntro")}
              </p>
              <AdminConsoleLazy currentUserId={userId} />
            </section>
          ) : null}

          <SalesDeskTargetCard profile={profile} userId={userId} variant="settings" />

          <Card className="overflow-hidden rounded-3xl border-border/60 bg-gradient-to-br from-card to-muted/20 shadow-md">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b border-border/40 pb-4">
              <div className="space-y-1">
                <CardTitle className="font-heading text-xl">{t("fieldAlignmentTitle")}</CardTitle>
                <CardDescription className="max-w-xl text-[15px] leading-relaxed">
                  {t("fieldAlignmentDesc")}
                </CardDescription>
              </div>
              <Link
                href="/sales?tab=log"
                prefetch
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex gap-1 rounded-full border-primary/25 font-semibold",
                )}
              >
                {t("openSalesLog")}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-3 pt-6 text-sm leading-relaxed">
              <p>{t("fieldAlignmentBody")}</p>
            </CardContent>
          </Card>

          {canSetTargetsForOthers ? (
            <Card className="overflow-hidden rounded-3xl border-border/60 shadow-md">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div>
                  <CardTitle className="font-heading text-xl">{t("targetAssignmentsTitle")}</CardTitle>
                  <CardDescription>{t("targetAssignmentsDesc")}</CardDescription>
                </div>
                <Button className="rounded-xl font-semibold shadow-sm" onClick={() => openNewTargetDialog()}>
                  {t("newTarget")}
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-6">
                {targets.length === 0 ? (
                  <p className="text-muted-foreground rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
                    {t("noTargetsYet")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {targets.map((tgt: Target) => (
                      <li
                        key={tgt.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/15 px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div>
                          <div className="font-medium capitalize">
                            {tgt.scope} · {tgt.period}
                          </div>
                          <div className="text-muted-foreground text-xs tabular-nums">
                            {tgt.starts_on} → {tgt.ends_on}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-heading text-foreground text-lg font-bold tabular-nums">
                            {formatCurrency(Number(tgt.amount), "ETB")}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl font-medium"
                            onClick={() => openEditTargetDialog(tgt)}
                          >
                            {t("edit")}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={targetDialogOpen}
        onOpenChange={(next) => {
          if (!next) setTargetDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {targetDialog?.type === "edit" ? t("targetDialogEdit") : t("targetDialogNew")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {canSetTargetsForOthers && targetDialog?.type === "create" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>{t("personLabel")}</Label>
                <Select
                  value={pickUserId}
                  onValueChange={(v) => {
                    if (!v) return;
                    setTUser(v);
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 rounded-xl">
                    <SelectValue placeholder={t("choosePerson")}>
                      {(value: string | null) => {
                        if (!value) return t("choosePerson");
                        const p = people.find((x) => x.id === value);
                        if (p) {
                          return `${p.display_name} · ${labelRole(p.role as UserRole)}`;
                        }
                        if (value === userId && profile?.display_name) {
                          return `${profile.display_name} · ${labelRole(role)}`;
                        }
                        return t("choosePerson");
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name} · {labelRole(p.role as UserRole)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : canSetTargetsForOthers && targetDialog?.type === "edit" ? (
              <div className="text-muted-foreground md:col-span-2 text-xs">{t("personLockedHint")}</div>
            ) : null}

            <div className="space-y-2">
              <Label>{t("periodLabel")}</Label>
              <Select
                value={tPeriod}
                onValueChange={(v) => {
                  if (!v) return;
                  setTPeriod(v as typeof tPeriod);
                }}
              >
                <SelectTrigger className="w-full min-w-0 rounded-xl">
                  <SelectValue placeholder={t("periodLabel")}>
                    {(value: string | null) =>
                      value === "daily"
                        ? t("periodDaily")
                        : value === "weekly"
                          ? t("periodWeekly")
                          : value === "monthly"
                            ? t("periodMonthly")
                            : t("periodLabel")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t("periodDaily")}</SelectItem>
                  <SelectItem value="weekly">{t("periodWeekly")}</SelectItem>
                  <SelectItem value="monthly">{t("periodMonthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cmd-target-amount">{t("amountLabel")}</Label>
              <Input
                id="cmd-target-amount"
                className="rounded-xl"
                inputMode="decimal"
                value={tAmount}
                onChange={(e) => setTAmount(e.target.value)}
              />
            </div>

            <DatePickerField
              id="cmd-target-starts"
              label={t("startsLabel")}
              value={tStarts}
              onChange={setTStarts}
            />
            <DatePickerField id="cmd-target-ends" label={t("endsLabel")} value={tEnds} onChange={setTEnds} />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            {targetDialog?.type === "edit" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={deleteTarget.isPending || updateTarget.isPending}
                  onClick={() => {
                    if (!window.confirm(t("deleteTargetConfirm"))) {
                      return;
                    }
                    deleteTarget.mutate(targetDialog.id);
                  }}
                >
                  {deleteTarget.isPending ? t("removingTarget") : t("deleteTarget")}
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={!tStarts || !tEnds || !tAmount || updateTarget.isPending || deleteTarget.isPending}
                  onClick={() => updateTarget.mutate(targetDialog.id)}
                >
                  {updateTarget.isPending ? t("saving") : t("saveTargetChanges")}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="rounded-xl"
                disabled={!tStarts || !tEnds || !tAmount || createTarget.isPending}
                onClick={() => createTarget.mutate()}
              >
                {createTarget.isPending ? t("creatingTarget") : t("createTarget")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
