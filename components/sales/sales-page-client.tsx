"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesDeskTargetCard } from "@/components/sales/sales-desk-target-card";
import { PipelineActivityFeed } from "@/components/sales-studio/pipeline-activity-feed";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormatMoney } from "@/lib/display-currency-store";
import { isOrgAdmin, isTaskforceMember } from "@/lib/roles";
import type { Profile, SalePaymentMethod, SalesEntry, UserRole } from "@/lib/types";
import { downloadXlsx } from "@/lib/export-xlsx";
import { coerceSaleIndustryTag } from "@/lib/sales-industries";
import { fullSaleSchema, type FullSaleFormValues, type FullSaleValues } from "@/lib/validators/sales";

const supabase = createBrowserSupabaseClient();
const PAGE_SIZE = 15;

/** Supabase nested relations are sometimes objects or single-element arrays. */
type Rel<T> = T | T[] | null | undefined;

type SalesTableRow = Pick<
  SalesEntry,
  | "id"
  | "team_id"
  | "user_id"
  | "industry"
  | "prospect_id"
  | "amount"
  | "amount_currency"
  | "customer_name"
  | "notes"
  | "sale_date"
  | "sale_collection_type"
  | "payment_method"
  | "payment_due_date"
  | "credit_collected_at"
  | "credit_notes"
  | "credit_term_days"
> & {
  created_at?: string;
  studio_prospects?: Rel<{ business_name: string }>;
  profiles?: Rel<{ display_name: string }>;
};

type SalesExportRow = {
  sale_date: string;
  amount: number;
  industry: string;
  studio_prospects?: SalesTableRow["studio_prospects"];
  profiles?: SalesTableRow["profiles"];
  customer_name?: string | null;
  notes?: string | null;
};

function relBusinessName(rel: SalesTableRow["studio_prospects"]): string {
  if (!rel) return "";
  const o = Array.isArray(rel) ? rel[0] : rel;
  return o?.business_name ?? "";
}

function rowCustomerLabel(r: SalesTableRow): string {
  return relBusinessName(r.studio_prospects) || r.customer_name || "—";
}

function relDisplayName(rel: SalesTableRow["profiles"]): string {
  if (!rel) return "";
  const o = Array.isArray(rel) ? rel[0] : rel;
  return o?.display_name ?? "";
}

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function isCreditOverdue(row: SalesTableRow): boolean {
  if (row.sale_collection_type !== "credit" || row.credit_collected_at || !row.payment_due_date) return false;
  return row.payment_due_date < todayYmd();
}

export function SalesPageClient({
  profile,
  userId,
}: {
  profile: Profile | null;
  userId: string;
}) {
  const t = useTranslations("studioPanels.salesDesk");
  const tAct = useTranslations("studioPanels.pipelineActivity");
  const locale = useLocale();
  const role = (profile?.role ?? "agent") as UserRole;
  const { money } = useFormatMoney();
  const queryClient = useQueryClient();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [paymentFilter, setPaymentFilter] = useState<SalePaymentMethod>("credit");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<SalesEntry | null>(null);

  const { data: addPipelineProspects = [] } = useQuery({
    queryKey: ["studio_prospects", "sales-desk", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_prospects")
        .select("id,business_name,industry")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; business_name: string; industry: string }[];
    },
  });

  const { data: editPipelineProspects = [] } = useQuery({
    queryKey: ["studio_prospects", "sales-edit", editing?.user_id ?? ""],
    enabled: editOpen && Boolean(editing),
    queryFn: async () => {
      const oid = editing?.user_id;
      if (!oid) return [];
      const { data, error } = await supabase
        .from("studio_prospects")
        .select("id,business_name,industry")
        .eq("owner_id", oid)
        .order("business_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; business_name: string; industry: string }[];
    },
  });

  const { data: pageRows, isFetching } = useQuery({
    queryKey: ["sales", "table", from, to, page, role, paymentFilter],
    queryFn: async () => {
      let q = supabase
        .from("sales_entries")
        .select(
          "id,team_id,user_id,industry,prospect_id,amount,amount_currency,customer_name,notes,sale_date,created_at,sale_collection_type,payment_method,payment_due_date,credit_collected_at,credit_notes,credit_term_days,studio_prospects(business_name),profiles(display_name)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
      q = q.eq("payment_method", paymentFilter);
      if (isTaskforceMember(role)) q = q.eq("user_id", profile?.id ?? "");

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as SalesTableRow[], count: count ?? 0 };
    },
  });

  const rows = useMemo(() => pageRows?.rows ?? [], [pageRows]);
  const total = pageRows?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const mySalesOnPage = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const r of rows) {
      if (r.user_id === userId) {
        sum += Number(r.amount) || 0;
        n += 1;
      }
    }
    return { sum, n };
  }, [rows, userId]);

  const form = useForm<FullSaleFormValues>({
    resolver: zodResolver(fullSaleSchema),
    defaultValues: {
      user_id: "",
      prospect_id: null,
      industry: coerceSaleIndustryTag(""),
      sale_collection_type: "full_amount",
      payment_method: "cash",
      payment_due_date: "",
      credit_notes: "",
      amount_currency: "ETB",
      amount: 1,
      customer_name: "",
      notes: "",
      sale_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const addForm = useForm<FullSaleFormValues>({
    resolver: zodResolver(fullSaleSchema),
    defaultValues: {
      user_id: userId,
      prospect_id: null,
      industry: coerceSaleIndustryTag(""),
      sale_collection_type: "full_amount",
      payment_method: "cash",
      payment_due_date: "",
      credit_notes: "",
      amount_currency: "ETB",
      amount: 1,
      customer_name: "",
      notes: "",
      sale_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const addSaleType = addForm.watch("sale_collection_type");

  const setAddDueFromDays = (days: number) => {
    const base = addForm.getValues("sale_date") || format(new Date(), "yyyy-MM-dd");
    addForm.setValue("payment_due_date", format(addDays(parseYmd(base), days), "yyyy-MM-dd"), {
      shouldValidate: true,
    });
  };

  const editSaleType = form.watch("sale_collection_type");

  const setEditDueFromDays = (days: number) => {
    const base = form.getValues("sale_date") || format(new Date(), "yyyy-MM-dd");
    form.setValue("payment_due_date", format(addDays(parseYmd(base), days), "yyyy-MM-dd"), {
      shouldValidate: true,
    });
  };

  useEffect(() => {
    addForm.setValue("user_id", userId);
  }, [userId, addForm]);

  useEffect(() => {
    if (!editing) return;
    const ind = coerceSaleIndustryTag(editing.industry);
    form.reset({
      user_id: editing.user_id,
      prospect_id: editing.prospect_id,
      industry: ind,
      sale_collection_type: editing.sale_collection_type ?? "full_amount",
      payment_method:
        editing.sale_collection_type === "credit"
          ? "credit"
          : (editing.payment_method === "cheque" ? "cheque" : "cash"),
      payment_due_date: editing.payment_due_date ?? "",
      credit_notes: editing.credit_notes ?? "",
      amount_currency: "ETB",
      amount: Number(editing.amount),
      customer_name: editing.customer_name ?? "",
      notes: editing.notes ?? "",
      sale_date: editing.sale_date,
    });
  }, [editing, form]);

  const saleFormInitializedRef = useRef(false);
  const lastSaleFormUserIdRef = useRef(userId);

  /** Initialize �?oLog a sale�?? once per user session �?" avoids wiping the form on every cache refresh. */
  useEffect(() => {
    if (lastSaleFormUserIdRef.current !== userId) {
      lastSaleFormUserIdRef.current = userId;
      saleFormInitializedRef.current = false;
    }
    if (saleFormInitializedRef.current) return;
    saleFormInitializedRef.current = true;

    const p0 = addPipelineProspects[0];
    const prospect0 = p0?.id ?? null;
    const ind0 = coerceSaleIndustryTag(p0?.industry);
    addForm.reset({
      user_id: userId,
      prospect_id: prospect0,
      industry: ind0,
      sale_collection_type: "full_amount",
      payment_method: "cash",
      payment_due_date: "",
      credit_notes: "",
      amount_currency: "ETB",
      amount: 1,
      customer_name: "",
      notes: "",
      sale_date: format(new Date(), "yyyy-MM-dd"),
    });
  }, [addPipelineProspects, userId, addForm]);

  const markCollected = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales_entries")
        .update({ credit_collected_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("markCollectedToast"));
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const insertSale = useMutation({
    mutationFn: async (values: FullSaleValues) => {
      const prospect = values.prospect_id
        ? addPipelineProspects.find((p) => p.id === values.prospect_id)
        : undefined;
      const customerName =
        (values.customer_name && values.customer_name.trim()) ||
        prospect?.business_name ||
        null;

      const termDays =
        values.sale_collection_type === "credit" && values.payment_due_date
          ? Math.max(
              0,
              differenceInCalendarDays(
                new Date(values.payment_due_date + "T12:00:00"),
                new Date(values.sale_date + "T12:00:00"),
              ),
            )
          : null;

      const { error } = await supabase.from("sales_entries").insert({
        team_id: null,
        user_id: values.user_id,
        industry: values.industry,
        prospect_id: values.prospect_id,
        amount: values.amount,
        amount_currency: "ETB",
        customer_name: customerName,
        notes: values.notes || null,
        sale_date: values.sale_date,
        sale_collection_type: values.sale_collection_type,
        payment_method: values.payment_method,
        payment_due_date: values.payment_due_date,
        credit_term_days: termDays,
        credit_notes: values.credit_notes,
      });
      if (error) throw error;

      if (
        values.sale_collection_type === "credit" &&
        values.payment_due_date &&
        values.prospect_id &&
        prospect
      ) {
        const due = new Date(values.payment_due_date + "T12:00:00");
        const leadDays = 3;
        const daysOut = differenceInCalendarDays(due, new Date());
        if (daysOut >= leadDays) {
          const { error: e1 } = await supabase.from("studio_alerts").insert({
            user_id: values.user_id,
            prospect_id: values.prospect_id,
            kind: "custom",
            title: `Credit payment approaching �?" ${prospect.business_name}`,
            body: `Logged from Sales desk; due ${values.payment_due_date}.`,
            due_on: format(addDays(due, -leadDays), "yyyy-MM-dd"),
            source: "manual",
          });
          if (e1) console.warn(e1);
        }
        const { error: e2 } = await supabase.from("studio_alerts").insert({
          user_id: values.user_id,
          prospect_id: values.prospect_id,
          kind: "custom",
          title: `Credit payment due �?" ${prospect.business_name}`,
          body: `Collect by ${values.payment_due_date}.`,
          due_on: values.payment_due_date,
          source: "manual",
        });
        if (e2) console.warn(e2);
        const { error: e3 } = await supabase.from("studio_alerts").insert({
          user_id: values.user_id,
          prospect_id: values.prospect_id,
          kind: "custom",
          title: `Credit overdue (if not collected) �?" ${prospect.business_name}`,
          body: `Original due ${values.payment_due_date}.`,
          due_on: format(addDays(due, 1), "yyyy-MM-dd"),
          source: "manual",
        });
        if (e3) console.warn(e3);
      }
    },
    onSuccess: async () => {
      toast.success(t("saleLoggedToast"));
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "performance-quarter-sales"] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "alerts-open-count", userId] });
      const p0 = addPipelineProspects[0];
      const prospect0 = p0?.id ?? null;
      const ind0 = coerceSaleIndustryTag(p0?.industry);
      addForm.reset({
        user_id: userId,
        prospect_id: prospect0,
        industry: ind0,
        sale_collection_type: "full_amount",
        payment_method: "cash",
        payment_due_date: "",
        credit_notes: "",
        amount_currency: "ETB",
        amount: 1,
        customer_name: "",
        notes: "",
        sale_date: format(new Date(), "yyyy-MM-dd"),
      });
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Could not save the sale. Try again.";
      toast.error(msg);
    },
  });

  const save = useMutation({
    mutationFn: async (values: FullSaleValues) => {
      if (!editing) return;
      const prospectList = editing.user_id === userId ? addPipelineProspects : editPipelineProspects;
      const prospect = values.prospect_id
        ? prospectList.find((p) => p.id === values.prospect_id)
        : undefined;
      const customerName =
        (values.customer_name && String(values.customer_name).trim()) ||
        prospect?.business_name ||
        null;

      const termDays =
        values.sale_collection_type === "credit" && values.payment_due_date
          ? Math.max(
              0,
              differenceInCalendarDays(
                new Date(values.payment_due_date + "T12:00:00"),
                new Date(values.sale_date + "T12:00:00"),
              ),
            )
          : null;

      const { error } = await supabase
        .from("sales_entries")
        .update({
          team_id: null,
          user_id: values.user_id,
          industry: values.industry,
          prospect_id: values.prospect_id,
          amount: values.amount,
          amount_currency: "ETB",
          customer_name: customerName,
          notes: values.notes,
          sale_date: values.sale_date,
          sale_collection_type: values.sale_collection_type,
          payment_method: values.payment_method,
          payment_due_date: values.payment_due_date,
          credit_term_days: termDays,
          credit_notes: values.credit_notes,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("saveUpdatedToast"));
      setEditOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-desk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["studio", "performance-quarter-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportExcel = useMutation({
    mutationFn: async () => {
      let q = supabase
        .from("sales_entries")
        .select(
          "amount,sale_date,customer_name,notes,industry,studio_prospects(business_name),profiles(display_name)",
        )
        .order("created_at", { ascending: false })
        .limit(5000);

      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
      if (isTaskforceMember(role)) q = q.eq("user_id", profile?.id ?? "");

      const { data, error } = await q;
      if (error) throw error;

      const headers = ["sale_date", "amount", "taskforce_member", "industry", "customer", "notes"];
      const rows = (data ?? []).map((r) => {
        const row = r as SalesExportRow;
        const customer = relBusinessName(row.studio_prospects) || row.customer_name || "";
        return [
          row.sale_date,
          row.amount,
          relDisplayName(row.profiles),
          row.industry ?? "",
          customer,
          (row.notes ?? "").replaceAll("\n", " "),
        ];
      });
      downloadXlsx("Sales", headers, rows, `sales-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <SalesDeskTargetCard profile={profile} userId={userId} />

      <PipelineActivityFeed compact title={tAct("title")} description={tAct("description")} />

      <Card className="surface-elevated overflow-hidden border-0 shadow-md">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="font-heading text-xl">{t("logSaleTitle")}</CardTitle>
          <CardDescription className="text-[15px]">{t("logSaleDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {addPipelineProspects.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{t("noProspectsHint")}</p>
          ) : (
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={addForm.handleSubmit(
                (v) => {
                  const prospectId =
                    v.prospect_id ?? (addPipelineProspects[0]?.id as string | null) ?? null;
                  if (!prospectId) {
                    toast.error(t("pickPipelineCustomerToast"));
                    return;
                  }
                  const pr = addPipelineProspects.find((p) => p.id === prospectId);
                  const parsed = fullSaleSchema.safeParse({
                    ...v,
                    user_id: userId,
                    prospect_id: prospectId,
                    industry: coerceSaleIndustryTag(pr?.industry),
                  });
                  if (!parsed.success) {
                    const msg = parsed.error.issues[0]?.message ?? "Check the form";
                    toast.error(msg);
                    return;
                  }
                  insertSale.mutate(parsed.data);
                },
                (errors) => {
                  const first = Object.values(errors)[0]?.message as string | undefined;
                  toast.error(first ?? "Fix the highlighted fields, then try again.");
                },
              )}
            >
              <input type="hidden" {...addForm.register("user_id")} />
              <div className="space-y-2 md:col-span-2">
                <Label>{t("pipelineCustomer")}</Label>
                <Controller
                  name="prospect_id"
                  control={addForm.control}
                  render={({ field }) => {
                    const selectValue =
                      field.value && addPipelineProspects.some((p) => p.id === field.value)
                        ? field.value
                        : (addPipelineProspects[0]?.id ?? "");
                    return (
                      <Select
                        value={selectValue}
                        onValueChange={(id) => {
                          if (!id) return;
                          field.onChange(id);
                          const pr = addPipelineProspects.find((p) => p.id === id);
                          if (pr?.industry?.trim()) {
                            addForm.setValue("industry", coerceSaleIndustryTag(pr.industry), {
                              shouldValidate: true,
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-full min-w-0 rounded-xl">
                          <SelectValue placeholder={t("selectCustomer")}>
                            {(value: string | null) => {
                              if (!value) return t("selectCustomer");
                              return (
                                addPipelineProspects.find((p) => p.id === value)?.business_name ??
                                t("selectCustomer")
                              );
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {addPipelineProspects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.business_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
              </div>
              <Controller
                name="sale_date"
                control={addForm.control}
                render={({ field }) => (
                  <DatePickerField
                    id="add-sale-date"
                    label={t("date")}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <div className="space-y-2 md:col-span-2">
                <Label>{t("saleType")}</Label>
                <Controller
                  name="sale_collection_type"
                  control={addForm.control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        if (v === "full_amount" || v === "credit") {
                          field.onChange(v);
                          if (v === "full_amount") {
                            addForm.setValue("payment_method", "cash", { shouldValidate: true });
                            addForm.setValue("payment_due_date", "", { shouldValidate: true });
                          } else {
                            addForm.setValue("payment_method", "credit", { shouldValidate: true });
                            setAddDueFromDays(30);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_amount">{t("saleTypeFull")}</SelectItem>
                        <SelectItem value="credit">{t("saleTypeCredit")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {addSaleType === "full_amount" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("paymentMethod")}</Label>
                  <Controller
                    name="payment_method"
                    control={addForm.control}
                    render={({ field }) => (
                      <Select
                        value={field.value === "credit" ? "cash" : (field.value ?? "cash")}
                        onValueChange={(v) => {
                          if (v === "cash" || v === "cheque") field.onChange(v);
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">{t("paymentTabsCash")}</SelectItem>
                          <SelectItem value="cheque">{t("paymentTabsCheque")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-border/70 p-3 md:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setAddDueFromDays(14)}>
                      {t("preset14")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setAddDueFromDays(30)}>
                      {t("preset30")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setAddDueFromDays(182)}>
                      {t("preset180")}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-payment-due">{t("paymentDue")}</Label>
                    <Input id="add-payment-due" type="date" className="rounded-xl" {...addForm.register("payment_due_date")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-custom-days">{t("customDays")}</Label>
                    <Input
                      id="add-custom-days"
                      type="number"
                      min={1}
                      className="rounded-xl"
                      placeholder="45"
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n > 0) setAddDueFromDays(Math.floor(n));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-credit-notes">{t("creditNotes")}</Label>
                    <Textarea
                      id="add-credit-notes"
                      className="rounded-xl"
                      rows={2}
                      placeholder={t("creditNotesPlaceholder")}
                      {...addForm.register("credit_notes")}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label>{t("amountEtb")}</Label>
                <Input className="rounded-xl" type="number" step="0.01" min={0} {...addForm.register("amount")} />
              </div>
              <div className="space-y-2">
                <Label>{t("customerLabelOptional")}</Label>
                <Input
                  className="rounded-xl"
                  placeholder={t("customerLabelHint")}
                  {...addForm.register("customer_name")}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("notes")}</Label>
                <Textarea className="rounded-xl" rows={2} {...addForm.register("notes")} />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  className="rounded-xl"
                  size="lg"
                  disabled={insertSale.isPending}
                >
                  {insertSale.isPending ? t("saving") : t("saveSale")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border">
        <CardHeader>
          <CardTitle>{t("filtersTitle")}</CardTitle>
          <CardDescription>
            {isOrgAdmin(role) || role === "manager" ? t("filtersOrg") : t("filtersSelf")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <DatePickerField
            id="sales-filter-from"
            label={t("from")}
            value={from}
            onChange={(v) => {
              setPage(0);
              setFrom(v);
            }}
          />
          <DatePickerField
            id="sales-filter-to"
            label={t("to")}
            value={to}
            onChange={(v) => {
              setPage(0);
              setTo(v);
            }}
          />
          <div className="flex items-end gap-2">
            <Button
              className="w-full rounded-xl"
              variant="outline"
              disabled={exportExcel.isPending}
              onClick={() => exportExcel.mutate()}
            >
              {t("exportExcel")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border">
        <CardHeader>
          <CardTitle>{t("entriesTitle")}</CardTitle>
          <CardDescription className="space-y-1">
            <span>
              {t("entriesPage", { page: page + 1, pages, total })}
            </span>
            {mySalesOnPage.n > 0 ? (
              <span className="text-foreground block font-medium">
                {t("yourSalesOnPage", {
                  amount: money(mySalesOnPage.sum),
                  count: mySalesOnPage.n,
                  entriesLabel: mySalesOnPage.n === 1 ? t("entry") : t("entries"),
                })}
              </span>
            ) : (
              <span className="block">{t("noYourEntriesOnPage")}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs
            value={paymentFilter}
            onValueChange={(v) => {
              if (v === "credit" || v === "cash" || v === "cheque") {
                setPaymentFilter(v);
                setPage(0);
              }
            }}
          >
            <TabsList className="h-auto flex-wrap rounded-xl">
              <TabsTrigger value="credit" className="rounded-lg">
                {t("paymentTabsCredit")}
              </TabsTrigger>
              <TabsTrigger value="cash" className="rounded-lg">
                {t("paymentTabsCash")}
              </TabsTrigger>
              <TabsTrigger value="cheque" className="rounded-lg">
                {t("paymentTabsCheque")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("when")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("owner")}</TableHead>
                  <TableHead>{t("industry")}</TableHead>
                  <TableHead>{t("method")}</TableHead>
                  <TableHead>{t("due")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      {t("loading")}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      {t("noRows")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const pmLabel =
                      r.payment_method === "credit"
                        ? t("paymentTabsCredit")
                        : r.payment_method === "cash"
                          ? t("paymentTabsCash")
                          : t("paymentTabsCheque");
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{r.sale_date}</TableCell>
                        <TableCell>{rowCustomerLabel(r)}</TableCell>
                        <TableCell>{relDisplayName(r.profiles) || "—"}</TableCell>
                        <TableCell>{r.industry || "—"}</TableCell>
                        <TableCell>{pmLabel}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                          {r.payment_due_date ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(Number(r.amount))}
                        </TableCell>
                        <TableCell>
                          {r.sale_collection_type === "credit" ? (
                            r.credit_collected_at ? (
                              <Badge variant="secondary" className="rounded-full font-normal">
                                {t("statusCollected")}
                              </Badge>
                            ) : isCreditOverdue(r) ? (
                              <Badge variant="destructive" className="rounded-full font-normal">
                                {t("statusOverdue")}
                              </Badge>
                            ) : r.payment_due_date ? (
                              <Badge variant="outline" className="rounded-full font-normal">
                                {t("statusDue", { date: r.payment_due_date })}
                              </Badge>
                            ) : (
                              "—"
                            )
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {r.sale_collection_type === "credit" && !r.credit_collected_at ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="rounded-lg"
                                disabled={markCollected.isPending}
                                onClick={() => markCollected.mutate(r.id)}
                              >
                                {t("markCollected")}
                              </Button>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={() => {
                                setEditing({
                                  id: r.id,
                                  team_id: r.team_id,
                                  user_id: r.user_id,
                                  industry: r.industry,
                                  prospect_id: r.prospect_id,
                                  amount: r.amount,
                                  amount_currency: "ETB",
                                  customer_name: r.customer_name,
                                  notes: r.notes,
                                  sale_date: r.sale_date,
                                  created_at: r.created_at ?? "",
                                  updated_at: r.created_at ?? "",
                                  sale_collection_type: r.sale_collection_type,
                                  payment_method: r.payment_method,
                                  payment_due_date: r.payment_due_date,
                                  credit_collected_at: r.credit_collected_at,
                                  credit_notes: r.credit_notes,
                                  credit_term_days: r.credit_term_days,
                                });
                                setEditOpen(true);
                              }}
                            >
                              {t("edit")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("next")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("editSaleTitle")}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              key={editing.id}
              className="space-y-3"
              onSubmit={form.handleSubmit((v) => {
                const editList =
                  editing.user_id === userId ? addPipelineProspects : editPipelineProspects;
                const pr = v.prospect_id ? editList.find((p) => p.id === v.prospect_id) : undefined;
                const parsed = fullSaleSchema.safeParse({
                  ...v,
                  industry: coerceSaleIndustryTag(pr?.industry ?? editing.industry),
                });
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Check the form");
                  return;
                }
                save.mutate(parsed.data);
              })}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Controller
                  name="prospect_id"
                  control={form.control}
                  render={({ field }) => {
                    const editList =
                      editing.user_id === userId ? addPipelineProspects : editPipelineProspects;
                    const selectValue =
                      field.value && editList.some((p) => p.id === field.value)
                        ? field.value
                        : "none";
                    return (
                      <div className="space-y-2 md:col-span-2">
                        <Label>{t("pipelineCustomer")}</Label>
                        <Select
                          value={selectValue}
                          onValueChange={(id) => {
                            if (!id) return;
                            field.onChange(id === "none" ? null : id);
                            if (id !== "none") {
                              const pr = editList.find((p) => p.id === id);
                              if (pr?.industry?.trim()) {
                                form.setValue("industry", coerceSaleIndustryTag(pr.industry), {
                                  shouldValidate: true,
                                });
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="w-full min-w-0 rounded-xl">
                            <SelectValue placeholder="Customer">
                              {(value: string | null) => {
                                if (!value || value === "none") return t("pipelineNone");
                                return (
                                  editList.find((p) => p.id === value)?.business_name ?? "Customer"
                                );
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("pipelineNone")}</SelectItem>
                            {editList.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.business_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }}
                />
                <Controller
                  name="sale_date"
                  control={form.control}
                  render={({ field }) => (
                    <DatePickerField
                      id="edit-sale-date"
                      label={t("date")}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t("saleType")}</Label>
                <Controller
                  name="sale_collection_type"
                  control={form.control}
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
                            setEditDueFromDays(30);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_amount">{t("saleTypeFull")}</SelectItem>
                        <SelectItem value="credit">{t("saleTypeCredit")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {editSaleType === "full_amount" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("paymentMethod")}</Label>
                  <Controller
                    name="payment_method"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value === "credit" ? "cash" : (field.value ?? "cash")}
                        onValueChange={(v) => {
                          if (v === "cash" || v === "cheque") field.onChange(v);
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">{t("paymentTabsCash")}</SelectItem>
                          <SelectItem value="cheque">{t("paymentTabsCheque")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-border/70 p-3 md:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setEditDueFromDays(14)}>
                      {t("preset14")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setEditDueFromDays(30)}>
                      {t("preset30")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setEditDueFromDays(182)}>
                      {t("preset180")}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-payment-due">{t("paymentDue")}</Label>
                    <Input id="edit-payment-due" type="date" className="rounded-xl" {...form.register("payment_due_date")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-custom-days">{t("customDays")}</Label>
                    <Input
                      id="edit-custom-days"
                      type="number"
                      min={1}
                      className="rounded-xl"
                      placeholder="45"
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n > 0) setEditDueFromDays(Math.floor(n));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-credit-notes">{t("creditNotes")}</Label>
                    <Textarea
                      id="edit-credit-notes"
                      className="rounded-xl"
                      rows={2}
                      placeholder={t("creditNotesPlaceholder")}
                      {...form.register("credit_notes")}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("amountEtb")}</Label>
                <Input className="rounded-xl" type="number" step="0.01" min={0} {...form.register("amount")} />
              </div>

              <div className="space-y-2">
                <Label>{t("customerLabelOptional")}</Label>
                <Input className="rounded-xl" {...form.register("customer_name")} />
              </div>

              <div className="space-y-2">
                <Label>{t("notes")}</Label>
                <Textarea className="rounded-xl" rows={3} {...form.register("notes")} />
              </div>

              <input type="hidden" {...form.register("user_id")} />

              <DialogFooter>
                <Button type="submit" className="rounded-xl" disabled={save.isPending}>
                  {save.isPending ? t("saving") : t("saveChanges")}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

