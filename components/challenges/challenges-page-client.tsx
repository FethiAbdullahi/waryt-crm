"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock,
  LayoutList,
  MessageSquareWarning,
  Pencil,
  PhoneMissed,
  Sparkles,
  Timer,
  Trash2,
  Waypoints,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormatMoney } from "@/lib/display-currency-store";
import { isOrgAdmin } from "@/lib/roles";
import type { Challenge, Profile, UserRole } from "@/lib/types";
import { ContextualHint } from "@/components/onboarding/contextual-hint";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

type BoardRow = {
  user_id: string;
  display_name: string;
  score: number;
  rank: number;
};

type ChallengeStatus = Challenge["status"];

type PhaseKey = "draft" | "upcoming" | "live" | "ended" | "completed" | "cancelled";

function localYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localHm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function challengePhase(c: Challenge, nowMs: number): PhaseKey {
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "completed") return "completed";
  if (c.status === "draft") return "draft";
  const start = new Date(c.starts_at).getTime();
  const end = new Date(c.ends_at).getTime();
  if (nowMs < start) return "upcoming";
  if (nowMs > end) return "ended";
  return "live";
}

/** Window progress 0–100 for the active time range; null when not applicable. */
function windowProgressPct(c: Challenge, nowMs: number): number | null {
  const phase = challengePhase(c, nowMs);
  if (phase === "completed" || phase === "cancelled") return null;
  const start = new Date(c.starts_at).getTime();
  const end = new Date(c.ends_at).getTime();
  if (end <= start) return null;
  if (nowMs <= start) return 0;
  if (nowMs >= end) return 100;
  return Math.round(((nowMs - start) / (end - start)) * 100);
}

function phasePresentation(phase: PhaseKey): {
  label: string;
  hint: string;
  badgeClass: string;
} {
  switch (phase) {
    case "draft":
      return {
        label: "Draft",
        hint: "Only you (and admins) see this until you mark it active.",
        badgeClass: "border-border/80 bg-muted/60 text-muted-foreground",
      };
    case "upcoming":
      return {
        label: "Pending",
        hint: "Window not open yet—use it to stage tomorrow's blockers.",
        badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
      };
    case "live":
      return {
        label: "Live",
        hint: "You're inside the window—tie desk sales here if you still use the scoreboard.",
        badgeClass: "border-primary/30 bg-primary/10 text-primary",
      };
    case "ended":
      return {
        label: "Window closed",
        hint: "Time is up—refresh the tally or mark it solved.",
        badgeClass: "border-chart-2/30 bg-chart-2/10 text-chart-2",
      };
    case "completed":
      return {
        label: "Solved",
        hint: "This entry is finished and sealed.",
        badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        hint: "This entry was called off.",
        badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
      };
    default:
      return {
        label: "Unknown",
        hint: "",
        badgeClass: "",
      };
  }
}

function formatChallengeMetric(metric: string) {
  const m = String(metric);
  if (m === "total_sales_amount") return "Total sales";
  return m.replace(/_/g, " ");
}

function defaultFormDates() {
  const d = new Date();
  const e = new Date();
  e.setDate(e.getDate() + 7);
  return {
    startDate: localYmd(d),
    startTime: "09:00",
    endDate: localYmd(e),
    endTime: "17:00",
  };
}

export function ChallengesPageClient({
  profile,
  userId,
}: {
  profile: Profile | null;
  userId: string;
}) {
  const role = (profile?.role ?? "agent") as UserRole;
  const { money } = useFormatMoney();
  const queryClient = useQueryClient();
  const [nowTick, setNowTick] = useState(() => Date.now());

  const { data: isTeamManager } = useQuery({
    queryKey: ["challenge-team-manager", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", userId)
        .eq("member_role", "manager")
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("ends_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Challenge[];
    },
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeSelectionId = activeId ?? challenges[0]?.id ?? null;

  const selected = useMemo(
    () => challenges.find((c) => c.id === activeSelectionId) ?? null,
    [challenges, activeSelectionId],
  );

  const selectedPhase = selected ? challengePhase(selected, nowTick) : null;
  const selectedProgress = selected ? windowProgressPct(selected, nowTick) : null;

  const { data: board = [] } = useQuery({
    queryKey: ["challenge-board", activeSelectionId],
    enabled: Boolean(activeSelectionId),
    queryFn: async () => {
      const id = activeSelectionId;
      if (!id) return [];
      const { data, error } = await supabase.rpc("rpc_challenge_leaderboard", {
        p_challenge_id: id,
      });
      if (error) throw error;
      return (data ?? []) as BoardRow[];
    },
  });

  const { data: participantCount = 0 } = useQuery({
    queryKey: ["challenge-participant-count", activeSelectionId],
    enabled: Boolean(activeSelectionId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("challenge_participants")
        .select("challenge_id", { count: "exact", head: true })
        .eq("challenge_id", activeSelectionId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const myRank = useMemo(() => board.find((r) => r.user_id === userId)?.rank ?? null, [board, userId]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("Main contact stopped picking up");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("17:00");
  const [statusField, setStatusField] = useState<ChallengeStatus>("active");

  const [deleteTarget, setDeleteTarget] = useState<Challenge | null>(null);

  const canOrgManage = isOrgAdmin(role) || role === "manager" || Boolean(isTeamManager);
  const canCreateChallenge = canOrgManage || role === "agent";

  const editingChallenge = useMemo(
    () => (editId ? (challenges.find((c) => c.id === editId) ?? null) : null),
    [editId, challenges],
  );

  const canEditSelectedChallenge =
    canOrgManage || (role === "agent" && selected?.created_by === userId);

  const showChallengeStatusField =
    formMode === "edit" &&
    (canOrgManage || (role === "agent" && editingChallenge?.created_by === userId));

  function openCreateForm() {
    const d = defaultFormDates();
    setFormMode("create");
    setEditId(null);
    setTitle("Main contact stopped picking up");
    setDescription("");
    setStartDate(d.startDate);
    setStartTime(d.startTime);
    setEndDate(d.endDate);
    setEndTime(d.endTime);
    setStatusField("active");
    setFormOpen(true);
  }

  function openEditForm(c: Challenge) {
    const s = new Date(c.starts_at);
    const e = new Date(c.ends_at);
    setFormMode("edit");
    setEditId(c.id);
    setTitle(c.title);
    setDescription(c.description ?? "");
    setStartDate(localYmd(s));
    setStartTime(localHm(s));
    setEndDate(localYmd(e));
    setEndTime(localHm(e));
    setStatusField(c.status);
    setFormOpen(true);
  }

  const saveChallenge = useMutation({
    mutationFn: async () => {
      const starts_at = new Date(`${startDate}T${startTime}:00`).toISOString();
      const ends_at = new Date(`${endDate}T${endTime}:00`).toISOString();
      if (new Date(ends_at) <= new Date(starts_at)) {
        throw new Error("End must be after start");
      }
      if (formMode === "create") {
        const { error } = await supabase.from("challenges").insert({
          title: title.trim(),
          description: description.trim() || null,
          starts_at,
          ends_at,
          status: statusField,
          created_by: userId,
        });
        if (error) throw error;
      } else if (editId) {
        const { error } = await supabase
          .from("challenges")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            starts_at,
            ends_at,
            status: statusField,
          })
          .eq("id", editId);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(formMode === "create" ? "Entry saved" : "Entry updated");
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["challenges"] });
      await queryClient.invalidateQueries({ queryKey: ["challenge-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteChallenge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("challenges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_, id) => {
      toast.success("Entry removed");
      setDeleteTarget(null);
      if (activeId === id || activeSelectionId === id) setActiveId(null);
      await queryClient.invalidateQueries({ queryKey: ["challenges"] });
      await queryClient.invalidateQueries({ queryKey: ["challenge-board"] });
      await queryClient.invalidateQueries({ queryKey: ["challenge-participant-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("challenges").update({ status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Marked as solved");
      await queryClient.invalidateQueries({ queryKey: ["challenges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc("refresh_challenge_scores", {
        p_challenge_id: challengeId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Tally refreshed");
      await queryClient.invalidateQueries({ queryKey: ["challenge-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="relative w-full max-w-none pb-14">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-chart-2/12 blur-3xl dark:bg-chart-2/8"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl dark:bg-primary/6"
        aria-hidden
      />

      <header className="relative mb-8 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-chart-2/[0.06] p-4 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/10 sm:rounded-3xl sm:p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-chart-2/20 bg-chart-2/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-chart-2">
              <Waypoints className="size-3" aria-hidden />
              Challenges
            </div>
            <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              Challenges
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
              {canOrgManage
                ? "You see every challenge entry in the organization (same list reps use on their side). Open one to review details and leaderboards."
                : "Capture what slowed you down with accounts—missed callbacks, gatekeepers, noisy inboxes. Each log is yours (and visible to org admins); dates help you pace the week and close the loop."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch md:flex-row md:items-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setNowTick(Date.now())}
            >
              <Timer className="mr-1.5 size-3.5" aria-hidden />
              Update labels
            </Button>
            {canCreateChallenge ? (
              <Button className="h-10 rounded-xl px-5 font-semibold shadow-sm" onClick={openCreateForm}>
                <Sparkles className="mr-2 size-4" aria-hidden />
                New entry
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <ContextualHint hintId="challenges" />

      {challenges.length === 0 ? (
        <Card className="overflow-hidden rounded-3xl border-border/60 shadow-md">
          <CardHeader className="border-b border-border/40 bg-gradient-to-r from-muted/40 to-transparent pb-4">
            <div className="flex items-center gap-3">
              <span className="bg-chart-2/15 text-chart-2 flex size-11 items-center justify-center rounded-2xl">
                <MessageSquareWarning className="size-5" aria-hidden />
              </span>
              <div>
                <CardTitle className="font-heading text-xl">Nothing logged yet</CardTitle>
                <CardDescription className="text-[15px] leading-relaxed">
                  {canCreateChallenge
                    ? "Add your first friction note—who went cold, which thread stalled, and what you'll try next."
                    : "You'll see friction notes here when they're shared with your role—otherwise ask an admin."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:gap-8">
          <aside className="space-y-2 lg:sticky lg:top-20">
            <div className="text-muted-foreground flex items-center gap-2 px-0.5 pb-1">
              <LayoutList className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <h2 className="text-xs font-semibold uppercase tracking-wider">
                {canOrgManage ? "Everyone" : "Your log"}
              </h2>
              <span className="ml-auto tabular-nums opacity-80">{challenges.length}</span>
            </div>
            <nav className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto pr-1" aria-label="Challenges log">
              {challenges.map((c) => {
                const phase = challengePhase(c, nowTick);
                const pres = phasePresentation(phase);
                const pct = windowProgressPct(c, nowTick);
                const isSel = c.id === activeSelectionId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "group text-left transition-colors",
                      "rounded-xl border py-3 pr-3 shadow-sm",
                      isSel
                        ? "border-border/80 border-l-4 border-l-primary bg-background pl-2.5 shadow-md ring-1 ring-primary/20"
                        : "border-border/70 bg-card/80 pl-3 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
                        {c.title}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          pres.badgeClass,
                        )}
                      >
                        {phase === "live" ? (
                          <PhoneMissed className="mr-0.5 size-2.5" aria-hidden />
                        ) : phase === "upcoming" || phase === "draft" ? (
                          <Clock className="mr-0.5 size-2.5" aria-hidden />
                        ) : phase === "completed" ? (
                          <CheckCircle2 className="mr-0.5 size-2.5" aria-hidden />
                        ) : (
                          <CircleDot className="mr-0.5 size-2.5" aria-hidden />
                        )}
                        {pres.label}
                      </span>
                      <span className="text-muted-foreground text-[11px] tabular-nums">
                        {new Date(c.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                        – {new Date(c.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {pct != null ? (
                      <div className="mt-2.5 space-y-1">
                        <div className="text-muted-foreground flex items-center justify-between text-[10px] font-medium uppercase tracking-wide">
                          <span>Window</span>
                          <span>{pct}%</span>
                        </div>
                        <Progress value={pct} className="gap-0">
                          <ProgressTrack className="h-1">
                            <ProgressIndicator />
                          </ProgressTrack>
                        </Progress>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            {selected ? (
              <Card className="overflow-hidden rounded-3xl border-border/60 shadow-md">
                <CardHeader className="space-y-4 border-b border-border/50 bg-muted/20 pb-4 pt-5 sm:pb-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedPhase ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                              phasePresentation(selectedPhase).badgeClass,
                            )}
                          >
                            {phasePresentation(selectedPhase).label}
                          </Badge>
                        ) : null}
                        <Badge variant="secondary" className="rounded-md text-[11px] font-normal">
                          {formatChallengeMetric(selected.metric)}
                        </Badge>
                      </div>
                      <CardTitle className="font-heading text-lg font-semibold leading-snug text-foreground sm:text-xl">
                        <span className="line-clamp-4 [overflow-wrap:anywhere]">{selected.title}</span>
                      </CardTitle>
                      <CardDescription className="flex flex-col gap-1 text-[13px] leading-relaxed sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-0">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <CalendarClock className="size-3.5 shrink-0 opacity-80" aria-hidden />
                          <span className="tabular-nums">
                            {new Date(selected.starts_at).toLocaleString()} —{" "}
                            {new Date(selected.ends_at).toLocaleString()}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <PhoneMissed className="size-3.5 shrink-0 opacity-80" aria-hidden />
                          {participantCount} on desk tally
                        </span>
                      </CardDescription>
                    </div>
                  </div>

                  {canEditSelectedChallenge || canOrgManage ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                      {canEditSelectedChallenge ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg"
                            onClick={() => openEditForm(selected)}
                          >
                            <Pencil className="mr-1.5 size-3.5" aria-hidden />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(selected)}
                          >
                            <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                            Delete
                          </Button>
                          {(selectedPhase === "live" ||
                            selectedPhase === "ended" ||
                            selectedPhase === "upcoming") &&
                          selected.status === "active" ? (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-9 rounded-lg"
                              onClick={() => markComplete.mutate(selected.id)}
                              disabled={markComplete.isPending}
                            >
                              <CheckCircle2 className="mr-1.5 size-3.5" aria-hidden />
                              Mark solved
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {canOrgManage || selected.created_by === userId ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 rounded-lg"
                          onClick={() => refresh.mutate(selected.id)}
                          disabled={refresh.isPending}
                        >
                          Refresh tally
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedProgress != null ? (
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <span>Progress through the window</span>
                        <span className="tabular-nums font-medium text-foreground">{selectedProgress}%</span>
                      </div>
                      <Progress value={selectedProgress} className="gap-0">
                        <ProgressTrack className="h-1.5">
                          <ProgressIndicator className="bg-primary" />
                        </ProgressTrack>
                      </Progress>
                    </div>
                  ) : selectedPhase ? (
                    <p className="text-muted-foreground text-sm">{phasePresentation(selectedPhase).hint}</p>
                  ) : null}

                  {selected.description ? (
                    <p className="text-muted-foreground border-t border-border/40 pt-3 text-sm leading-relaxed">
                      {selected.description}
                    </p>
                  ) : null}
                </CardHeader>

                <CardContent className="space-y-4 pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading text-foreground text-base font-semibold">Desk tally</h3>
                    {myRank != null ? (
                      <span className="text-muted-foreground text-xs">
                        Your rank{" "}
                        <span className="text-primary font-semibold tabular-nums">#{myRank}</span>
                      </span>
                    ) : null}
                  </div>

                  {board.length === 0 ? (
                    <p className="text-muted-foreground rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-center text-sm">
                      No desk sales counted in this window yet. Log deals on the Sales log tab while the
                      window is live, then hit Refresh tally.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
                      {board.map((row) => {
                        const medal =
                          row.rank === 1
                            ? "from-amber-400 to-amber-600 text-white"
                            : row.rank === 2
                              ? "from-slate-300 to-slate-500 text-white"
                              : row.rank === 3
                                ? "from-amber-700 to-amber-900 text-amber-50"
                                : "bg-muted text-muted-foreground";
                        const isYou = row.user_id === userId;
                        return (
                          <li
                            key={row.user_id}
                            className={cn(
                              "flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors",
                              isYou ? "bg-primary/[0.06]" : "hover:bg-muted/30",
                            )}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div
                                className={cn(
                                  "flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold",
                                  medal,
                                )}
                              >
                                {row.rank}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {row.display_name}
                                  {isYou ? (
                                    <span className="text-primary ml-2 text-xs font-normal">You</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="font-medium tabular-nums">{money(Number(row.score))}</div>
                              <div className="text-muted-foreground text-[10px]">In window</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </section>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "New challenge" : "Edit challenge"}</DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Give it a window so you can pace follow-ups. Only you and org admins can read what you write here."
                : "Update copy, dates, or status. Desk tally rows stay unless you delete the whole entry."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {showChallengeStatusField ? (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusField} onValueChange={(v) => setStatusField(v as ChallengeStatus)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed (solved)</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="ch-title">Title</Label>
              <Input
                id="ch-title"
                className="rounded-xl"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-desc">Description</Label>
              <Textarea
                id="ch-desc"
                className="rounded-xl"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <DatePickerField
                  id="challenge-start-date"
                  label="Starts (date)"
                  value={startDate}
                  onChange={setStartDate}
                />
                <div className="space-y-2">
                  <Label htmlFor="challenge-start-time">Starts (time)</Label>
                  <Input
                    id="challenge-start-time"
                    type="time"
                    className="rounded-xl"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <DatePickerField
                  id="challenge-end-date"
                  label="Ends (date)"
                  value={endDate}
                  onChange={setEndDate}
                />
                <div className="space-y-2">
                  <Label htmlFor="challenge-end-time">Ends (time)</Label>
                  <Input
                    id="challenge-end-time"
                    type="time"
                    className="rounded-xl"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={
                !title.trim() ||
                !startDate ||
                !endDate ||
                !startTime ||
                !endTime ||
                saveChallenge.isPending
              }
              onClick={() => saveChallenge.mutate()}
            >
              {saveChallenge.isPending ? "Saving…" : formMode === "create" ? "Create" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              This removes “{deleteTarget?.title}” and any desk tally rows tied to it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={!deleteTarget || deleteChallenge.isPending}
              onClick={() => deleteTarget && deleteChallenge.mutate(deleteTarget.id)}
            >
              {deleteChallenge.isPending ? "Deleting…" : "Delete entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
