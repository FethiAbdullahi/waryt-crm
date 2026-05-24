"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Trash2, UsersRound } from "lucide-react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  resolveStudioIndustry,
  splitStudioIndustry,
  STUDIO_INDUSTRY_MAX_LEN,
} from "@/lib/sales-studio/industry";
import {
  COMPANY_SIZE_BANDS,
  labelAccountStatus,
  labelStage,
  LEAD_INDUSTRIES,
  STUDIO_ACCOUNT_STATUS,
  STUDIO_STAGES,
} from "@/lib/sales-studio/routes";
import { studioProspectsQueryKey } from "@/lib/sales-studio/query-keys";
import { isTaskforceMember } from "@/lib/roles";
import type { StudioProspect, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { studioProspectFormSchema, type StudioProspectFormValues } from "@/lib/validators/studio";

const supabase = createBrowserSupabaseClient();

function prospectToDefaults(p: StudioProspect | null): StudioProspectFormValues {
  if (!p) {
    return {
      business_name: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      team_id: "",
      industry_preset: "SMEs",
      industry_other: "",
      company_size_band: "1-10",
      stage: "new",
      account_status: "active_prospect",
      interested_modules: "",
      pain_points: "",
      pricing_notes: "",
      mrr_monthly: 0,
      renewal_on: "",
      credit_expires_on: "",
      needs_cs_attention: false,
      won_deal_amount: 0,
    };
  }
  const { preset, other } = splitStudioIndustry(p.industry);
  return {
    business_name: p.business_name,
    contact_name: p.contact_name ?? "",
    contact_email: p.contact_email?.trim() ?? "",
    contact_phone: p.contact_phone?.trim() ?? "",
    team_id: p.team_id ?? "",
    industry_preset: preset,
    industry_other: other,
    company_size_band: p.company_size_band as StudioProspectFormValues["company_size_band"],
    stage: p.stage as StudioProspectFormValues["stage"],
    account_status: p.account_status as StudioProspectFormValues["account_status"],
    interested_modules: p.interested_modules ?? "",
    pain_points: p.pain_points ?? "",
    pricing_notes: p.pricing_notes ?? "",
    mrr_monthly: Number(p.mrr_monthly),
    renewal_on: p.renewal_on ?? "",
    credit_expires_on: p.credit_expires_on ?? "",
    needs_cs_attention: p.needs_cs_attention,
    won_deal_amount: 0,
  };
}

export function ProspectFormDialog({
  open,
  onOpenChange,
  prospect,
  userId,
  role,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospect: StudioProspect | null;
  userId: string;
  /** Used to block taskforce from creating duplicate company names (with DB trigger). */
  role?: UserRole;
}) {
  const t = useTranslations("studioPipeline.prospectForm");
  const tToast = useTranslations("toasts.prospect");
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const [debouncedBusiness, setDebouncedBusiness] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  /** Anyone editing a row may attempt remove; RLS allows owner, org admins, and team managers of the owner. */
  const showRemoveFromPipeline = Boolean(prospect);

  const form = useForm<StudioProspectFormValues>({
    resolver: zodResolver(studioProspectFormSchema) as Resolver<StudioProspectFormValues>,
    defaultValues: prospectToDefaults(null),
  });

  const watchedBusiness = form.watch("business_name");

  useEffect(() => {
    if (!open) {
      setDebouncedBusiness("");
      return;
    }
    const t = window.setTimeout(() => setDebouncedBusiness(watchedBusiness.trim()), 450);
    return () => window.clearTimeout(t);
  }, [open, watchedBusiness]);

  const { data: nameDuplicateRows = [] } = useQuery({
    queryKey: ["studio_pipeline_business_name_duplicates", debouncedBusiness, prospect?.id ?? ""],
    enabled: open && debouncedBusiness.trim().length >= 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("studio_pipeline_business_name_duplicates", {
        p_name: debouncedBusiness,
        p_exclude_id: prospect?.id ?? null,
      });
      if (error) throw error;
      return (data ?? []) as {
        prospect_id: string;
        owner_id: string;
        business_name: string;
        owner_display_name: string;
      }[];
    },
  });

  type MyTeamRow = {
    team_id: string;
    is_primary: boolean;
    teams: { id: string; name: string } | { id: string; name: string }[] | null;
  };

  const { data: myTeamRows = [] } = useQuery({
    queryKey: ["my_sales_teams", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id,is_primary,teams(id,name)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as unknown as MyTeamRow[];
    },
  });

  const teamOptions = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    for (const r of myTeamRows) {
      const id = r.team_id;
      const raw = r.teams;
      const teamRow = Array.isArray(raw) ? raw[0] : raw;
      const name = teamRow?.name?.trim() || t("teamFallbackName");
      if (id) out.push({ id, name });
    }
    return out;
  }, [myTeamRows, t]);

  const watchedTeamId = form.watch("team_id")?.trim() ?? "";
  const teamIdMissingFromOptions =
    Boolean(watchedTeamId) && watchedTeamId !== "__none__" && !teamOptions.some((o) => o.id === watchedTeamId);

  const { data: orphanTeam } = useQuery({
    queryKey: ["team_display_name", watchedTeamId],
    enabled: open && teamIdMissingFromOptions,
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id,name").eq("id", watchedTeamId).maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string | null } | null;
    },
  });

  const teamOptionsForDisplay = useMemo(() => {
    if (!orphanTeam?.id || teamOptions.some((o) => o.id === orphanTeam.id)) return teamOptions;
    const name = orphanTeam.name?.trim() || t("teamFallbackName");
    return [...teamOptions, { id: orphanTeam.id, name }];
  }, [teamOptions, orphanTeam, t]);

  const primaryTeamId = useMemo(() => {
    const primary = myTeamRows.find((r) => r.is_primary)?.team_id;
    if (primary) return primary;
    return myTeamRows[0]?.team_id ?? "";
  }, [myTeamRows]);

  useEffect(() => {
    if (!open || prospect) return;
    if (!primaryTeamId) return;
    const cur = form.getValues("team_id")?.trim() ?? "";
    if (!cur) form.setValue("team_id", primaryTeamId);
  }, [open, prospect, primaryTeamId, form]);

  useEffect(() => {
    if (!open) setDeleteConfirmOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    form.reset(prospectToDefaults(prospect));
  }, [open, prospect?.id, prospect?.updated_at, form]); // eslint-disable-line react-hooks/exhaustive-deps -- narrow keys; full `prospect` would reset too often

  const isTaskforceNewBlocked =
    !prospect && role != null && isTaskforceMember(role) && nameDuplicateRows.length > 0;

  const save = useMutation({
    mutationFn: async (values: StudioProspectFormValues) => {
      const trimmedBusiness = values.business_name.trim();
      if (!prospect && role != null && isTaskforceMember(role)) {
        const { data: dupCheck, error: dupErr } = await supabase.rpc(
          "studio_pipeline_business_name_duplicates",
          {
            p_name: trimmedBusiness,
            p_exclude_id: null,
          },
        );
        if (dupErr) throw dupErr;
        if ((dupCheck ?? []).length > 0) {
          throw new Error(
            "DUPLICATE_PIPELINE_BUSINESS: That company name is already on the pipeline. Taskforce members cannot add a duplicate.",
          );
        }
      }

      const commercial = prospect
        ? {
            pricing_notes: prospect.pricing_notes ?? null,
            mrr_monthly: Number(prospect.mrr_monthly ?? 0),
            renewal_on: prospect.renewal_on?.trim() ? prospect.renewal_on.trim() : null,
            credit_expires_on: prospect.credit_expires_on?.trim()
              ? prospect.credit_expires_on.trim()
              : null,
            needs_cs_attention: prospect.needs_cs_attention,
          }
        : {
            pricing_notes: null,
            mrr_monthly: 0,
            renewal_on: null,
            credit_expires_on: null,
            needs_cs_attention: false,
          };

      const resolveClosedDealAmount = (): number | null => {
        if (!prospect) return null;
        return values.stage === "won" ? (prospect.closed_deal_amount ?? null) : null;
      };

      const tid = values.team_id.trim();
      const team_id = tid || null;

      const row = {
        business_name: values.business_name.trim(),
        contact_name: values.contact_name.trim() ? values.contact_name.trim() : null,
        contact_email: values.contact_email.trim() ? values.contact_email.trim() : null,
        contact_phone: values.contact_phone.trim() ? values.contact_phone.trim() : null,
        team_id,
        industry: resolveStudioIndustry(values.industry_preset, values.industry_other),
        company_size_band: values.company_size_band,
        stage: values.stage,
        account_status: values.account_status,
        interested_modules: values.interested_modules.trim() ? values.interested_modules.trim() : null,
        pain_points: values.pain_points.trim() ? values.pain_points.trim() : null,
        closed_deal_amount: resolveClosedDealAmount(),
        ...commercial,
      };
      if (prospect) {
        const { error } = await supabase.from("studio_prospects").update(row).eq("id", prospect.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("studio_prospects").insert({
          ...row,
          owner_id: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: studioProspectsQueryKey(userId) });
      toast.success(prospect ? tToast("updated") : tToast("created"));
      onOpenChange(false);
    },
    onError: (e: Error) => {
      const msg = e.message ?? "";
      if (msg.includes("DUPLICATE_PIPELINE_BUSINESS")) {
        toast.error(tToast("duplicateBlocked"));
        return;
      }
      toast.error(msg);
    },
  });

  const removeProspect = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("studio_prospects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: studioProspectsQueryKey(userId) });
      await qc.invalidateQueries({ queryKey: ["studio", "activity-feed"] });
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      toast.success(tToast("removed"));
    },
    onError: (e: Error) => {
      toast.error(e.message ?? tToast("removeFailed"));
    },
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,48rem)] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{prospect ? t("editTitle") : t("newTitle")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <p className="text-muted-foreground text-sm">{t("intro")}</p>

          <div className="space-y-2">
            <Label htmlFor="sp-business">{t("businessLabel")}</Label>
            <p className="text-muted-foreground text-xs leading-relaxed">{t("businessHint")}</p>
            <Input id="sp-business" className="rounded-xl" {...form.register("business_name")} />
            {form.formState.errors.business_name ? (
              <p className="text-destructive text-sm">{form.formState.errors.business_name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sp-contact">{t("contactLabel")}</Label>
            <Input id="sp-contact" className="rounded-xl" {...form.register("contact_name")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sp-email">{t("emailLabel")}</Label>
              <Input
                id="sp-email"
                type="email"
                className="rounded-xl"
                placeholder={t("emailPlaceholder")}
                {...form.register("contact_email")}
              />
              {form.formState.errors.contact_email ? (
                <p className="text-destructive text-sm">{form.formState.errors.contact_email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sp-phone">{t("phoneLabel")}</Label>
              <Input id="sp-phone" className="rounded-xl" placeholder={t("phonePlaceholder")} {...form.register("contact_phone")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <UsersRound className="text-muted-foreground size-4" aria-hidden />
              {t("teamLabel")}
            </Label>
            <p className="text-muted-foreground text-xs leading-relaxed">{t("teamHint")}</p>
            {teamOptions.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-sm">
                {t("noTeamHint")}
              </p>
            ) : (
              <Controller
                control={form.control}
                name="team_id"
                render={({ field }) => (
                  <Select
                    value={field.value?.trim() ? field.value : "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger id="sp-team" className="max-w-md rounded-xl">
                      <SelectValue placeholder={t("teamPlaceholder")}>
                        {(value: string | string[] | null) => {
                          const raw = Array.isArray(value) ? value[0] : value;
                          if (raw == null || raw === "" || raw === "__none__") {
                            return t("teamPlaceholder");
                          }
                          const label = teamOptionsForDisplay.find((o) => o.id === raw)?.name;
                          return label ?? t("teamDisplayUnknown");
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("noTeam")}</SelectItem>
                      {teamOptionsForDisplay.map((tm) => (
                        <SelectItem key={tm.id} value={tm.id} label={tm.name}>
                          {tm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {form.formState.errors.team_id ? (
              <p className="text-destructive text-sm">{form.formState.errors.team_id.message}</p>
            ) : null}
          </div>

          {nameDuplicateRows.length > 0 ? (
            <div
              role="alert"
              className={cn(
                "rounded-xl border p-3 text-sm leading-relaxed",
                isTaskforceNewBlocked
                  ? "border-destructive/50 bg-destructive/5"
                  : "border-amber-500/40 bg-amber-500/5",
              )}
            >
              <p className="font-medium text-foreground">
                {isTaskforceNewBlocked ? t("dupBlockedTitle") : t("dupSimilarTitle")}
              </p>
              <p className="text-muted-foreground mt-1">
                <span className="text-foreground">{t("dupMatchCount", { count: nameDuplicateRows.length })}</span>{" "}
                {isTaskforceNewBlocked ? (
                  t("dupBlockedBody")
                ) : nameDuplicateRows.some((r) => r.owner_id !== userId) ? (
                  t("dupOthersBody")
                ) : (
                  t("dupOwnBody")
                )}
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-muted-foreground">
                {nameDuplicateRows.slice(0, 6).map((r) => (
                  <li key={r.prospect_id}>
                    <span className="font-medium text-foreground">{r.business_name}</span>
                    <span> · {r.owner_display_name}</span>
                  </li>
                ))}
              </ul>
              {prospect ? (
                <p className="text-muted-foreground mt-3 border-t border-border/50 pt-3 text-sm">
                  {t("deleteHintBefore")}{" "}
                  <span className="font-medium text-foreground">{t("deleteHintRemove")}</span>{" "}
                  {t("deleteHintAfter")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{t("industryLabel")}</Label>
            <Controller
              control={form.control}
              name="industry_preset"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="max-w-md rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.industry_preset ? (
              <p className="text-destructive text-sm">{form.formState.errors.industry_preset.message}</p>
            ) : null}
            {form.watch("industry_preset") === "Other" ? (
              <div className="space-y-2 pt-1">
                <Label htmlFor="sp-industry-other">{t("industryOtherLabel")}</Label>
                <Input
                  id="sp-industry-other"
                  className="max-w-md rounded-xl"
                  placeholder={t("industryOtherPlaceholder")}
                  maxLength={STUDIO_INDUSTRY_MAX_LEN}
                  {...form.register("industry_other")}
                />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("industryOtherHint", { max: STUDIO_INDUSTRY_MAX_LEN })}
                </p>
                {form.formState.errors.industry_other ? (
                  <p className="text-destructive text-sm">{form.formState.errors.industry_other.message}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("companySizeLabel")}</Label>
            <Controller
              control={form.control}
              name="company_size_band"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="max-w-md rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZE_BANDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("stageLabel")}</Label>
              <Controller
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl">
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
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("accountStatusLabel")}</Label>
              <Controller
                control={form.control}
                name="account_status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STUDIO_ACCOUNT_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {labelAccountStatus(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sp-modules">{t("featuresLabel")}</Label>
            <Textarea id="sp-modules" className="rounded-xl" rows={2} {...form.register("interested_modules")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sp-pain">{t("painLabel")}</Label>
            <Textarea id="sp-pain" className="rounded-xl" rows={3} {...form.register("pain_points")} />
          </div>

          <DialogFooter
            className={cn(
              "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2",
              showRemoveFromPipeline ? "sm:justify-between" : "sm:justify-end",
            )}
          >
            {showRemoveFromPipeline ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:order-first"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="mr-2 size-4" aria-hidden />
                {t("removeFromPipeline")}
              </Button>
            ) : null}
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" className="rounded-xl" disabled={save.isPending || isTaskforceNewBlocked}>
                {save.isPending ? t("saving") : prospect ? t("saveChanges") : t("createLead")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("deleteDescription", {
              name: prospect?.business_name?.trim() ? prospect.business_name.trim() : t("deleteDefaultName"),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDeleteConfirmOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={!prospect || removeProspect.isPending}
            onClick={() => {
              if (!prospect) return;
              removeProspect.mutate(prospect.id);
            }}
          >
            {removeProspect.isPending ? t("removing") : t("removeAccount")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
