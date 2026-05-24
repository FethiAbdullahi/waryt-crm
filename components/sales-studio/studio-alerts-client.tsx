"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isBefore, parseISO } from "date-fns";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { studioProspectsQueryKey } from "@/lib/sales-studio/query-keys";
import { STUDIO_ALERT_KINDS } from "@/lib/sales-studio/routes";
import type { StudioAlert, StudioProspect } from "@/lib/types";
import { studioAlertSchema, type StudioAlertValues } from "@/lib/validators/studio";

const supabase = createBrowserSupabaseClient();

function daysFromNow(n: number) {
  return format(addDays(new Date(), n), "yyyy-MM-dd");
}

export function StudioAlertsClient({ userId }: { userId: string }) {
  const t = useTranslations("studioPanels.alerts");
  const tAlertKind = useTranslations("studioPanels.alerts.alertKind");
  const qc = useQueryClient();
  const form = useForm<StudioAlertValues>({
    resolver: zodResolver(studioAlertSchema) as Resolver<StudioAlertValues>,
    defaultValues: {
      prospect_id: null,
      kind: "custom",
      title: "",
      body: "",
      due_on: daysFromNow(3),
    },
  });

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["studio", "alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_alerts")
        .select("*")
        .order("due_on", { ascending: true })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as StudioAlert[];
    },
  });

  const { data: prospects = [] } = useQuery({
    queryKey: studioProspectsQueryKey(userId),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("studio_prospects").select("*");
      if (error) throw error;
      return (data ?? []) as StudioProspect[];
    },
  });

  const mine = prospects.filter((p) => p.owner_id === userId);
  const soon = addDays(new Date(), 60);
  const suggestions = mine.filter((p) => {
    if (p.account_status === "non_paying") return true;
    if (p.needs_cs_attention) return true;
    if (p.renewal_on && !isBefore(soon, parseISO(p.renewal_on))) return true;
    if (p.credit_expires_on && !isBefore(soon, parseISO(p.credit_expires_on))) return true;
    return false;
  });

  const openAlerts = alerts.filter((a) => a.user_id === userId && !a.resolved_at);

  const insert = useMutation({
    mutationFn: async (values: StudioAlertValues) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("studio_alerts").insert({
        user_id: u.user.id,
        prospect_id: values.prospect_id,
        kind: values.kind,
        title: values.title.trim(),
        body: values.body.trim() ? values.body.trim() : null,
        due_on: values.due_on,
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["studio", "alerts"] });
      await qc.invalidateQueries({ queryKey: ["studio", "alerts-open-count", userId] });
      toast.success(t("reminderCreatedToast"));
      form.reset({
        prospect_id: null,
        kind: "custom",
        title: "",
        body: "",
        due_on: daysFromNow(3),
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("studio_alerts")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["studio", "alerts"] });
      await qc.invalidateQueries({ queryKey: ["studio", "alerts-open-count", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncAuto = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rpc_auto_studio_alerts_for_me", { p_horizon_days: 45 });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["studio", "alerts"] });
      await qc.invalidateQueries({ queryKey: ["studio", "alerts-open-count", userId] });
      toast.success(t("smartSyncedToast"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("createFollowUpTitle")}</CardTitle>
          <CardDescription>{t("createFollowUpDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => insert.mutate(v))}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("kind")}</Label>
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STUDIO_ALERT_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {tAlertKind(k)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("linkAccount")}</Label>
                <Controller
                  control={form.control}
                  name="prospect_id"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={t("none")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("none")}</SelectItem>
                        {mine.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.business_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="al-title">{t("title")}</Label>
              <Input id="al-title" className="rounded-xl" {...form.register("title")} />
              {form.formState.errors.title ? (
                <p className="text-destructive text-sm">{form.formState.errors.title.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="al-body">{t("notes")}</Label>
              <Textarea id="al-body" rows={2} className="rounded-xl" {...form.register("body")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="al-due">{t("dueDate")}</Label>
              <Input id="al-due" type="date" className="rounded-xl" {...form.register("due_on")} />
            </div>
            <Button type="submit" className="rounded-xl" disabled={insert.isPending}>
              {insert.isPending ? t("saving") : t("addReminder")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("suggestedTitle")}</CardTitle>
          <CardDescription>{t("suggestedDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("nothingFlagged")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {suggestions.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
                  <span className="font-medium">{p.business_name}</span>
                  <div className="flex flex-wrap gap-2">
                    {p.account_status === "non_paying" ? (
                      <Badge variant="destructive" className="rounded-full">
                        {t("nonPaying")}
                      </Badge>
                    ) : null}
                    {p.needs_cs_attention ? (
                      <Badge variant="secondary" className="rounded-full">
                        {t("cs")}
                      </Badge>
                    ) : null}
                    {p.renewal_on ? (
                      <Badge variant="outline" className="rounded-full">
                        {t("renewal", { date: p.renewal_on })}
                      </Badge>
                    ) : null}
                    {p.credit_expires_on ? (
                      <Badge variant="outline" className="rounded-full">
                        {t("credit", { date: p.credit_expires_on })}
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("openRemindersTitle")}</CardTitle>
            <CardDescription>{t("openRemindersDescription")}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            disabled={syncAuto.isPending}
            onClick={() => syncAuto.mutate()}
          >
            {syncAuto.isPending ? t("syncing") : t("syncSmart")}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : openAlerts.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noOpenReminders")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tableDue")}</TableHead>
                    <TableHead>{t("tableKind")}</TableHead>
                    <TableHead>{t("tableTitle")}</TableHead>
                    <TableHead className="text-right">{t("tableAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openAlerts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">{a.due_on}</TableCell>
                      <TableCell>{tAlertKind(a.kind)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{a.title}</span>
                          {a.source === "auto" ? (
                            <Badge variant="secondary" className="rounded-full text-xs">
                              {t("autoBadge")}
                            </Badge>
                          ) : null}
                        </div>
                        {a.body ? (
                          <p className="text-muted-foreground line-clamp-2 text-sm">{a.body}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate(a.id)}
                        >
                          {t("resolve")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
