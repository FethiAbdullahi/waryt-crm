"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  History,
  Pencil,
  Plus,
  Sparkles,
  Target as TargetIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormatMoney } from "@/lib/display-currency-store";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { entryAmountToStoredEtb, saleAmountAsUsdForStats, storedEtbToDisplayAmount } from "@/lib/sales-amount-entry";
import { isOrgAdmin } from "@/lib/roles";
import type { Profile, Target, TargetEditHistoryRow, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const supabase = createBrowserSupabaseClient();

function periodLabel(p: string) {
  if (p === "daily") return "Daily";
  if (p === "weekly") return "Weekly";
  return "Monthly";
}

function snapshotLine(prefix: string, row: Record<string, unknown>, money: (n: number) => string) {
  const amt = row.amount != null ? money(Number(row.amount)) : "—";
  const per = typeof row.period === "string" ? periodLabel(row.period) : "—";
  const s = row.starts_on != null ? String(row.starts_on) : "—";
  const e = row.ends_on != null ? String(row.ends_on) : "—";
  return `${prefix}: ${amt} · ${per} · ${s} → ${e}`;
}

export function SalesDeskTargetCard({
  profile,
  userId,
  /** When shown inside Settings → Command, hide the footer that points back to Command. */
  variant = "sales",
}: {
  profile: Profile | null;
  userId: string;
  variant?: "sales" | "settings";
}) {
  const { money } = useFormatMoney();
  const role = (profile?.role ?? "agent") as UserRole;
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  /** `create` = add another row even if one is already active for today; `edit` = update that row. */
  const [deskDialog, setDeskDialog] = useState<null | { mode: "create" } | { mode: "edit"; target: Target }>(
    null,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tPeriod, setTPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [tStarts, setTStarts] = useState("");
  const [tEnds, setTEnds] = useState("");
  const [tAmount, setTAmount] = useState("");

  const { data: activeTarget } = useQuery({
    queryKey: ["sales-desk", "target", userId, today],
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
      return (data?.[0] ?? null) as Target | null;
    },
  });

  const windowEnd = useMemo(() => {
    if (!activeTarget) return today;
    return activeTarget.ends_on < today ? activeTarget.ends_on : today;
  }, [activeTarget, today]);

  const { data: windowTotal = 0 } = useQuery({
    queryKey: ["sales-desk", "window-sales", userId, activeTarget?.starts_on, windowEnd],
    enabled: Boolean(activeTarget),
    queryFn: async () => {
      if (!activeTarget) return 0;
      let sum = 0;
      let from = 0;
      const page = 1000;
      for (;;) {
        const { data, error } = await supabase
          .from("sales_entries")
          .select("amount,amount_currency")
          .eq("user_id", userId)
          .gte("sale_date", activeTarget.starts_on)
          .lte("sale_date", windowEnd)
          .range(from, from + page - 1);
        if (error) throw error;
        const rows = data ?? [];
        for (const r of rows) {
          const row = r as { amount: number; amount_currency?: string | null };
          sum += saleAmountAsUsdForStats(Number(row.amount), row.amount_currency);
        }
        if (rows.length < page) break;
        from += page;
      }
      return sum;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["sales-desk", "target-history", activeTarget?.id],
    enabled: Boolean(activeTarget?.id) && historyOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("target_edit_history")
        .select("id,created_at,previous,next,edited_by")
        .eq("target_id", activeTarget!.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as TargetEditHistoryRow[];
    },
  });

  const goal = activeTarget ? Number(activeTarget.amount) : null;
  const progressPct =
    goal && goal > 0 ? Math.min(100, Math.round((windowTotal / goal) * 100)) : null;

  function defaultNewTargetDates() {
    const now = new Date();
    return {
      starts: format(startOfMonth(now), "yyyy-MM-dd"),
      ends: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  }

  function openCreateTarget() {
    setTPeriod("monthly");
    const { starts, ends } = defaultNewTargetDates();
    setTStarts(starts);
    setTEnds(ends);
    setTAmount("");
    setDeskDialog({ mode: "create" });
  }

  function openEditTarget(t: Target) {
    setTPeriod(t.period);
    setTStarts(t.starts_on);
    setTEnds(t.ends_on);
    setTAmount(String(storedEtbToDisplayAmount(Number(t.amount))));
    setDeskDialog({ mode: "edit", target: t });
  }

  const createTarget = useMutation({
    mutationFn: async () => {
      const amt = Number(tAmount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      if (!tStarts || !tEnds) throw new Error("Pick start and end dates");
      const stored = entryAmountToStoredEtb(amt);
      const { error } = await supabase.from("targets").insert({
        scope: "user",
        user_id: userId,
        team_id: null,
        period: tPeriod,
        starts_on: tStarts,
        ends_on: tEnds,
        amount: stored,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Target saved");
      setDeskDialog(null);
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["targets"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTarget = useMutation({
    mutationFn: async (id: string) => {
      const amt = Number(tAmount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      if (!tStarts || !tEnds) throw new Error("Pick start and end dates");
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
      toast.success("Target updated — change logged in history");
      setDeskDialog(null);
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["targets"] });
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
      toast.success("Target removed");
      setDeskDialog(null);
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["targets"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-violet-600/90 via-indigo-600/95 to-sky-700/90 text-white shadow-lg ring-1 ring-white/15">
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-cyan-300/20 blur-2xl"
          aria-hidden
        />
        <CardHeader className="relative z-10 space-y-1 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <TargetIcon className="size-5" aria-hidden />
              </span>
              <div>
                <CardTitle className="font-heading text-xl text-white">Your sales target</CardTitle>
                <CardDescription className="text-sm text-white/75">
                  Shows your newest active goal for today (if several overlap). Tune anytime—edits stay in
                  history.
                </CardDescription>
              </div>
            </div>
            <Sparkles className="size-5 shrink-0 text-amber-200/90" aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4 pt-0">
          {!activeTarget ? (
            <div className="rounded-xl border border-white/20 bg-black/15 px-4 py-3 text-sm text-white/90">
              <p className="font-medium">No active target for today</p>
              <p className="mt-1 text-white/75">
                Set a goal so this desk and your home dashboard stay aligned.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 rounded-xl bg-white text-indigo-900 hover:bg-white/90"
                onClick={() => openCreateTarget()}
              >
                Set a target
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-white/60">Goal</p>
                  <p className="text-3xl font-bold tabular-nums tracking-tight">
                    {money(goal ?? 0)}
                  </p>
                  <p className="mt-1 text-sm text-white/75">
                    {activeTarget.starts_on} → {activeTarget.ends_on} · {periodLabel(activeTarget.period)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-white/40 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => openCreateTarget()}
                  >
                    <Plus className="mr-1.5 size-3.5" aria-hidden />
                    Add another target
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="rounded-xl border-0 bg-white/95 text-indigo-900 hover:bg-white"
                    onClick={() => openEditTarget(activeTarget)}
                  >
                    <Pencil className="mr-1.5 size-3.5" aria-hidden />
                    Edit target
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-white/40 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => setHistoryOpen((o) => !o)}
                  >
                    <History className="mr-1.5 size-3.5" aria-hidden />
                    History
                    {historyOpen ? (
                      <ChevronUp className="ml-1 size-3.5" aria-hidden />
                    ) : (
                      <ChevronDown className="ml-1 size-3.5" aria-hidden />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/80">
                  <span>Progress in window</span>
                  <span className="tabular-nums font-semibold">
                    {money(windowTotal)} · {progressPct ?? 0}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/25 ring-1 ring-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r from-amber-300 via-lime-200 to-emerald-300 transition-[width] duration-500",
                    )}
                    style={{ width: `${progressPct ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-white/65">
                  {goal && goal > 0
                    ? `${money(Math.max(goal - windowTotal, 0))} to go in this period.`
                    : null}
                </p>
              </div>

              {historyOpen ? (
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-black/20 p-3 text-sm">
                  {history.length === 0 ? (
                    <p className="text-white/70">No edits recorded yet—changes appear after you save an update.</p>
                  ) : (
                    <ul className="space-y-3">
                      {history.map((h) => {
                        const prev = (h.previous ?? {}) as Record<string, unknown>;
                        const next = (h.next ?? {}) as Record<string, unknown>;
                        const editor =
                          h.edited_by === userId ? "You" : "Another authorized user";
                        return (
                          <li key={h.id} className="border-b border-white/10 pb-3 last:border-0 last:pb-0">
                            <p className="text-xs text-white/55">
                              {new Date(h.created_at).toLocaleString()} · {editor}
                            </p>
                            <p className="mt-1 text-white/90">{snapshotLine("Before", prev, money)}</p>
                            <p className="text-emerald-200/95">{snapshotLine("After", next, money)}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </>
          )}

          {variant === "sales" && (isOrgAdmin(role) || role === "manager") ? (
            <p className="border-t border-white/15 pt-3 text-xs text-white/65">
              Assigning targets for teammates lives in{" "}
              <Link href="/settings" className="font-medium text-white underline-offset-2 hover:underline">
                Settings → Command
              </Link>
              .
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={deskDialog !== null}
        onOpenChange={(next) => {
          if (!next) setDeskDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {deskDialog?.mode === "create" ? "Add a new target" : "Edit your target"}
            </DialogTitle>
            {deskDialog?.mode === "create" && activeTarget ? (
              <DialogDescription>
                This creates an additional goal window. The card above still highlights your strongest
                active target for today—you can delete or edit any row anytime.
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Period</Label>
              <Select
                value={tPeriod}
                onValueChange={(v) => {
                  if (!v) return;
                  setTPeriod(v as typeof tPeriod);
                }}
              >
                <SelectTrigger className="w-full min-w-0 rounded-xl">
                  <SelectValue placeholder="Period">
                    {(value: string | null) =>
                      value === "daily"
                        ? "Daily"
                        : value === "weekly"
                          ? "Weekly"
                          : value === "monthly"
                            ? "Monthly"
                            : "Period"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="desk-target-amount">Amount (ETB)</Label>
              <Input
                id="desk-target-amount"
                className="rounded-xl"
                inputMode="decimal"
                value={tAmount}
                onChange={(e) => setTAmount(e.target.value)}
              />
            </div>
            <DatePickerField id="desk-target-starts" label="Starts" value={tStarts} onChange={setTStarts} />
            <DatePickerField id="desk-target-ends" label="Ends" value={tEnds} onChange={setTEnds} />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            {deskDialog?.mode === "edit" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={deleteTarget.isPending || updateTarget.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Remove this target? Your dashboard will use the next best match.",
                      )
                    ) {
                      return;
                    }
                    deleteTarget.mutate(deskDialog.target.id);
                  }}
                >
                  {deleteTarget.isPending ? "Removing…" : "Delete"}
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={
                    !tStarts || !tEnds || !tAmount || updateTarget.isPending || deleteTarget.isPending
                  }
                  onClick={() => updateTarget.mutate(deskDialog.target.id)}
                >
                  {updateTarget.isPending ? "Saving…" : "Save changes"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="rounded-xl"
                disabled={!tStarts || !tEnds || !tAmount || createTarget.isPending}
                onClick={() => createTarget.mutate()}
              >
                {createTarget.isPending ? "Creating…" : "Create target"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
