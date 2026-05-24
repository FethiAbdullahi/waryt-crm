"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format, subDays } from "date-fns";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { coerceSaleIndustryTag } from "@/lib/sales-industries";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { labelStage } from "@/lib/sales-studio/routes";
import { studioProspectsQueryKey } from "@/lib/sales-studio/query-keys";
import { useFormatMoney } from "@/lib/display-currency-store";
import { useUiStore } from "@/lib/stores/ui-store";
import { useSatisfactionStore } from "@/lib/stores/satisfaction-store";
import { quickSaleSchema, type QuickSaleFormValues, type QuickSaleValues } from "@/lib/validators/sales";

const supabase = createBrowserSupabaseClient();

type ProspectRow = {
  id: string;
  business_name: string;
  industry: string;
  stage: string;
  account_status: string | null;
};

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function QuickAddSaleDialog({ userId }: { userId: string }) {
  const t = useTranslations("studioPanels.quickAdd");
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  const queryClient = useQueryClient();
  const { money } = useFormatMoney();

  const { data: prospects = [] } = useQuery({
    queryKey: ["studio_prospects", "quick-add", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_prospects")
        .select("id,business_name,industry,stage,account_status")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProspectRow[];
    },
  });

  const form = useForm<QuickSaleFormValues>({
    defaultValues: {
      prospect_id: "",
      pipeline_sync: "won_paying",
      sale_collection_type: "full_amount",
      payment_method: "cash",
      payment_due_date: "",
      credit_notes: "",
      amount_currency: "ETB",
      amount: "",
    },
  });

  const prospectId = form.watch("prospect_id");
  const saleType = form.watch("sale_collection_type");

  const prospectMissingFromList =
    Boolean(prospectId?.trim()) && !prospects.some((p) => p.id === prospectId);

  const { data: orphanProspect } = useQuery({
    queryKey: ["studio_prospects", "quick-add-orphan", prospectId],
    enabled: open && prospectMissingFromList,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_prospects")
        .select("id,business_name,industry,stage,account_status")
        .eq("id", prospectId)
        .maybeSingle();
      if (error) throw error;
      return data as ProspectRow | null;
    },
  });

  const prospectsForDisplay = useMemo(() => {
    if (!orphanProspect?.id || prospects.some((p) => p.id === orphanProspect.id)) return prospects;
    return [...prospects, orphanProspect];
  }, [prospects, orphanProspect]);

  const selectedProspect = useMemo(
    () => prospectsForDisplay.find((p) => p.id === prospectId),
    [prospectsForDisplay, prospectId],
  );

  const isPayingWon = useMemo(() => {
    if (!selectedProspect) return false;
    const won = String(selectedProspect.stage ?? "").toLowerCase() === "won";
    const paying = String(selectedProspect.account_status ?? "") === "paying";
    return won && paying;
  }, [selectedProspect]);

  const { data: openCredits = [] } = useQuery({
    queryKey: ["studio", "open-credits", userId, prospectId],
    enabled: open && Boolean(prospectId?.trim()),
    queryFn: async () => {
      const pid = prospectId.trim();
      const { data, error } = await supabase
        .from("sales_entries")
        .select("id,amount,amount_currency,sale_date,payment_due_date,sale_collection_type")
        .eq("user_id", userId)
        .eq("prospect_id", pid)
        .eq("sale_collection_type", "credit")
        .is("credit_collected_at", null)
        .order("sale_date", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        amount: number | string;
        amount_currency?: string | null;
        sale_date: string;
        payment_due_date: string | null;
        sale_collection_type: string;
      }[];
    },
  });

  const hasOpenCredit = openCredits.length > 0;

  useEffect(() => {
    if (!open || !isPayingWon) return;
    form.setValue("pipeline_sync", "log_only", { shouldValidate: true });
  }, [open, isPayingWon, form]);

  useEffect(() => {
    if (!open || !hasOpenCredit) return;
    if (saleType === "credit") {
      form.setValue("sale_collection_type", "full_amount", { shouldValidate: true });
      form.setValue("payment_method", "cash", { shouldValidate: true });
      form.setValue("payment_due_date", "", { shouldValidate: true });
    }
  }, [open, hasOpenCredit, saleType, form]);

  const setDueFromDays = (days: number) => {
    const today = new Date();
    form.setValue("payment_due_date", format(addDays(today, days), "yyyy-MM-dd"), { shouldValidate: true });
  };

  const mutation = useMutation({
    mutationFn: async (values: QuickSaleValues) => {
      const prospect = prospectsForDisplay.find((p) => p.id === values.prospect_id);
      if (!prospect) throw new Error("Pipeline customer not found.");

      if (values.sale_collection_type === "credit") {
        const open = await supabase
          .from("sales_entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("prospect_id", values.prospect_id)
          .eq("sale_collection_type", "credit")
          .is("credit_collected_at", null);
        if (open.error) throw open.error;
        if ((open.count ?? 0) > 0) {
          throw new Error(t("openCreditBlock"));
        }
      }

      if (values.sync_won_paying) {
        const won = String(prospect.stage ?? "").toLowerCase() === "won";
        const paying = String(prospect.account_status ?? "") === "paying";
        if (won && paying) {
          throw new Error(t("payingWonSyncBlocked"));
        }
      }

      const customerName = prospect.business_name;
      const industry = coerceSaleIndustryTag(prospect.industry);
      const today = new Date().toISOString().slice(0, 10);
      const termDays =
        values.sale_collection_type === "credit" && values.payment_due_date
          ? Math.max(0, differenceInCalendarDays(parseYmd(values.payment_due_date), parseYmd(today)))
          : null;

      const { data: inserted, error } = await supabase
        .from("sales_entries")
        .insert({
        team_id: null,
        user_id: userId,
        industry,
        prospect_id: values.prospect_id,
        customer_name: customerName,
        amount: values.amount,
        amount_currency: "ETB",
        sale_date: today,
        sale_collection_type: values.sale_collection_type,
        payment_method: values.payment_method,
        payment_due_date: values.payment_due_date,
        credit_term_days: termDays,
        credit_notes: values.credit_notes,
      })
        .select("id")
        .single();

      if (error) throw error;

      if (values.sale_collection_type === "credit" && values.payment_due_date) {
        const due = parseYmd(values.payment_due_date);
        const leadDays = 3;
        const daysOut = differenceInCalendarDays(due, new Date());
        if (daysOut >= leadDays) {
          const { error: e1 } = await supabase.from("studio_alerts").insert({
            user_id: userId,
            prospect_id: values.prospect_id,
            kind: "custom",
            title: `Credit payment approaching — ${prospect.business_name}`,
            body: `Sale amount logged; payment due ${values.payment_due_date}.${values.credit_notes ? ` Notes: ${values.credit_notes}` : ""}`,
            due_on: format(subDays(due, leadDays), "yyyy-MM-dd"),
            source: "manual",
          });
          if (e1) console.warn(e1);
        }
        const { error: e2 } = await supabase.from("studio_alerts").insert({
          user_id: userId,
          prospect_id: values.prospect_id,
          kind: "custom",
          title: `Credit payment due — ${prospect.business_name}`,
          body: `Collect by ${values.payment_due_date}.${values.credit_notes ? ` Notes: ${values.credit_notes}` : ""}`,
          due_on: values.payment_due_date,
          source: "manual",
        });
        if (e2) console.warn(e2);

        const overdueOn = format(addDays(due, 1), "yyyy-MM-dd");
        const { error: e3 } = await supabase.from("studio_alerts").insert({
          user_id: userId,
          prospect_id: values.prospect_id,
          kind: "custom",
          title: `Credit overdue (if not collected) — ${prospect.business_name}`,
          body: `Original due ${values.payment_due_date}. Mark collected in Sales log when paid.`,
          due_on: overdueOn,
          source: "manual",
        });
        if (e3) console.warn(e3);
      }

      if (values.sync_won_paying) {
        const { data: row, error: selErr } = await supabase
          .from("studio_prospects")
          .select("mrr_monthly,stage")
          .eq("id", values.prospect_id)
          .maybeSingle();
        if (selErr) throw selErr;
        if (!row) {
          throw new Error("Pipeline row not found or you are not the owner.");
        }

        const prevMrr = Number(row.mrr_monthly ?? 0);
        const alreadyWon = String(row.stage ?? "").toLowerCase() === "won";
        const closedAt = new Date(`${today}T12:00:00.000Z`).toISOString();
        const patch: {
          stage: string;
          account_status: string;
          mrr_monthly: number;
          closed_deal_at?: string;
        } = {
          stage: "won",
          account_status: "paying",
          mrr_monthly: prevMrr + values.amount,
        };
        if (!alreadyWon) {
          patch.closed_deal_at = closedAt;
        }

        const { data: updated, error: upErr } = await supabase
          .from("studio_prospects")
          .update(patch)
          .eq("id", values.prospect_id)
          .select("id,stage,account_status")
          .maybeSingle();
        if (upErr) throw upErr;
        if (!updated) {
          throw new Error(
            "Sale was saved but the pipeline row did not update — you may not own this account, or access was blocked.",
          );
        }
        const st = String(updated.stage ?? "").trim().toLowerCase();
        if (st !== "won") {
          throw new Error(
            `Pipeline stage did not save as Won (got "${String(updated.stage ?? "").trim() || "unknown"}").`,
          );
        }
      }

      return {
        customerName,
        prospectId: values.prospect_id,
        saleId: inserted.id as string,
        openSatisfaction: values.sync_won_paying,
      };
    },
    onSuccess: async (result) => {
      toast.success(t("saleAddedToast"));
      setOpen(false);
      form.reset({
        prospect_id: "",
        pipeline_sync: "won_paying",
        sale_collection_type: "full_amount",
        payment_method: "cash",
        payment_due_date: "",
        credit_notes: "",
        amount_currency: "ETB",
        amount: "",
      });
      if (result.openSatisfaction) {
        useSatisfactionStore.getState().openPrompt({
          customerName: result.customerName,
          prospectId: result.prospectId,
          saleId: result.saleId,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "performance-quarter-sales"] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "quarter-target-overlap-sum"] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "open-credits", userId] });
      await queryClient.invalidateQueries({ queryKey: studioProspectsQueryKey(userId) });
      await queryClient.invalidateQueries({ queryKey: ["studio_prospects", "quick-add", userId] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "alerts-open-count", userId] });
    },
    onError: (e: Error) => {
      toast.error(e.message || t("addFailedGeneric"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(() => {
            const parsed = quickSaleSchema.safeParse(form.getValues());
            if (!parsed.success) {
              const msg = parsed.error.issues[0]?.message ?? t("checkInputs");
              toast.error(msg);
              return;
            }
            mutation.mutate(parsed.data);
          })}
        >
          {prospects.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{t("noProspects")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="prospect">{t("pickCompany")}</Label>
                <Select
                  value={
                    prospectId?.trim() && prospectsForDisplay.some((p) => p.id === prospectId)
                      ? prospectId
                      : "__pick__"
                  }
                  onValueChange={(v) => {
                    if (v == null || v === "__pick__") {
                      form.setValue("prospect_id", "", { shouldValidate: true });
                      return;
                    }
                    form.setValue("prospect_id", v, { shouldValidate: true });
                    const p = prospectsForDisplay.find((x) => x.id === v);
                    const payingWon =
                      p &&
                      String(p.stage ?? "").toLowerCase() === "won" &&
                      String(p.account_status ?? "") === "paying";
                    form.setValue("pipeline_sync", payingWon ? "log_only" : "won_paying", {
                      shouldValidate: true,
                    });
                  }}
                >
                  <SelectTrigger id="prospect" className="w-full min-w-0 rounded-xl">
                    <SelectValue placeholder={t("pickCompanyPlaceholder")}>
                      {(value: string | string[] | null) => {
                        const raw = Array.isArray(value) ? value[0] : value;
                        if (raw == null || raw === "" || raw === "__pick__") {
                          return t("pickCompanyPlaceholder");
                        }
                        const name = prospectsForDisplay.find((p) => p.id === raw)?.business_name?.trim();
                        return name && name.length > 0 ? name : t("companyDisplayUnknown");
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__pick__">{t("pickCompanyPlaceholder")}</SelectItem>
                    {prospectsForDisplay.map((p) => (
                      <SelectItem key={p.id} value={p.id} label={p.business_name}>
                        {p.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!prospectId ? (
                  <p className="text-muted-foreground text-xs leading-relaxed">{t("pickCompanyHint")}</p>
                ) : null}
              </div>

              {prospectId ? (
                <>
                  {hasOpenCredit ? (
                    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm leading-relaxed">
                      <p className="text-foreground font-medium">{t("openCreditTitle")}</p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                        {openCredits.map((c) => (
                          <li key={c.id}>
                            {money(Number(c.amount ?? 0))}
                            {c.payment_due_date
                              ? ` · ${t("dueLabel")} ${c.payment_due_date}`
                              : null}{" "}
                            · {c.sale_date}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-muted-foreground">{t("openCreditHint")}</p>
                    </div>
                  ) : null}
                  {isPayingWon ? (
                    <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 p-3 text-sm leading-relaxed">
                      <p className="text-foreground font-medium">{t("payingWonTitle")}</p>
                      <p className="mt-1 text-muted-foreground">{t("payingWonBody")}</p>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="pipeline_sync">{t("pipelineWhenSave")}</Label>
                    <Select
                      value={form.watch("pipeline_sync") ?? "won_paying"}
                      onValueChange={(v) => {
                        if (v === "won_paying" || v === "log_only") {
                          form.setValue("pipeline_sync", v, { shouldValidate: true });
                        }
                      }}
                    >
                      <SelectTrigger id="pipeline_sync" className="w-full min-w-0 rounded-xl">
                        <SelectValue placeholder={t("pipelinePlaceholder")}>
                          {(value: string | string[] | null) => {
                            const raw = Array.isArray(value) ? value[0] : value;
                            if (raw === "log_only") return t("logOnly");
                            if (raw === "won_paying") return t("wonPaying");
                            return t("pipelinePlaceholder");
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="won_paying" label={t("wonPaying")} disabled={isPayingWon}>
                          {t("wonPaying")}
                        </SelectItem>
                        <SelectItem value="log_only" label={t("logOnly")}>
                          {t("logOnly")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedProspect ? (
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {t("currentStage")}{" "}
                        <span className="text-foreground font-medium">{labelStage(selectedProspect.stage)}</span>
                        {form.watch("pipeline_sync") === "won_paying" ? (
                          <>
                            {" "}
                            {t("afterSave")}{" "}
                            <span className="text-foreground font-medium">{t("afterSaveWonPaying")}</span>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("saleType")}</Label>
                    <Controller
                      control={form.control}
                      name="sale_collection_type"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            if (v === "full_amount" || v === "credit") {
                              field.onChange(v);
                              if (v === "full_amount") {
                                form.setValue("payment_method", "cash", { shouldValidate: true });
                                form.setValue("payment_due_date", "", { shouldValidate: true });
                              } else {
                                form.setValue("payment_method", "credit", { shouldValidate: true });
                                setDueFromDays(30);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue>
                              {(value: string | string[] | null) => {
                                const raw = Array.isArray(value) ? value[0] : value;
                                if (raw === "credit") return t("credit");
                                if (raw === "full_amount") return t("fullAmount");
                                return t("fullAmount");
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_amount" label={t("fullAmount")}>
                              {t("fullAmount")}
                            </SelectItem>
                            <SelectItem value="credit" label={t("credit")} disabled={hasOpenCredit}>
                              {t("credit")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {saleType === "full_amount" ? (
                    <div className="space-y-2">
                      <Label>{t("paymentMethod")}</Label>
                      <Controller
                        control={form.control}
                        name="payment_method"
                        render={({ field }) => (
                          <Select
                            value={field.value === "credit" ? "cash" : (field.value ?? "cash")}
                            onValueChange={(v) => {
                              if (v === "cash" || v === "cheque") field.onChange(v);
                            }}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue>
                                {(value: string | string[] | null) => {
                                  const raw = Array.isArray(value) ? value[0] : value;
                                  if (raw === "cheque") return t("cheque");
                                  return t("cash");
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash" label={t("cash")}>
                                {t("cash")}
                              </SelectItem>
                              <SelectItem value="cheque" label={t("cheque")}>
                                {t("cheque")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-border/70 p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setDueFromDays(14)}>
                          {t("duePreset14")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setDueFromDays(30)}>
                          {t("duePreset30")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setDueFromDays(182)}>
                          {t("duePreset180")}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment_due_date">{t("paymentDue")}</Label>
                        <Input id="payment_due_date" type="date" className="rounded-xl" {...form.register("payment_due_date")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom_days">{t("customDaysLabel")}</Label>
                        <Input
                          id="custom_days"
                          type="number"
                          min={1}
                          className="rounded-xl"
                          placeholder={t("customDaysPlaceholder")}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n) && n > 0) setDueFromDays(Math.floor(n));
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="credit_notes">{t("creditNotes")}</Label>
                        <Textarea id="credit_notes" rows={2} className="rounded-xl" {...form.register("credit_notes")} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                      <Label htmlFor="amount">{t("amount")} (ETB)</Label>
                      <Input
                        id="amount"
                        className="rounded-xl"
                        inputMode="decimal"
                        placeholder="250000"
                        {...form.register("amount")}
                      />
                    </div>

                  <Button type="submit" className="w-full rounded-xl" size="lg" disabled={mutation.isPending}>
                    {mutation.isPending ? t("saving") : t("saveSale")}
                  </Button>
                </>
              ) : null}
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
