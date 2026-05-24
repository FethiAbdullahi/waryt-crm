"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Download, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { InteractionFormDialog } from "@/components/sales-studio/interaction-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { downloadXlsx } from "@/lib/export-xlsx";
import { canAccessManagerRoutes } from "@/lib/roles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { CustomerInteraction, UserRole } from "@/lib/types";

const supabase = createBrowserSupabaseClient();

const SELECT =
  "*,interaction_purchased_items(*),interaction_segment_tags(segment_id,marketing_segments(name,category)),profiles(display_name)";

function segmentNames(row: CustomerInteraction): string {
  const tags = row.interaction_segment_tags ?? [];
  return tags
    .map((t) => {
      const s = t.marketing_segments;
      const o = Array.isArray(s) ? s[0] : s;
      return o?.name ?? "";
    })
    .filter(Boolean)
    .join("; ");
}

function purchasedSummary(row: CustomerInteraction): string {
  const items = row.interaction_purchased_items ?? [];
  if (items.length === 0) return "—";
  return items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ");
}

export function StudioInteractionsClient({ userId, role }: { userId: string; role: UserRole }) {
  const t = useTranslations("interactions");
  const approvalStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: t("statusDraft"),
      submitted: t("statusSubmitted"),
      approved: t("statusApproved"),
      rejected: t("statusRejected"),
    };
    return map[status] ?? status;
  };
  const segmentLabel = (s: string) => (s === "b2b" ? t("segmentB2b") : s === "b2c" ? t("segmentB2c") : s);
  const yesNo = (v: boolean | null | undefined) => (v === true ? t("yes") : v === false ? t("no") : "");
  const qc = useQueryClient();
  const isManager = canAccessManagerRoutes(role);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerInteraction | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["customer_interactions", statusFilter],
    queryFn: async () => {
      let q = supabase.from("customer_interactions").select(SELECT).order("interaction_date", { ascending: false });
      if (statusFilter !== "all") q = q.eq("approval_status", statusFilter);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data ?? []) as CustomerInteraction[];
    },
  });

  const { data: segments = [] } = useQuery({
    queryKey: ["marketing_segments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_segments").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (segmentFilter === "all") return rows;
    return rows.filter((r) =>
      (r.interaction_segment_tags ?? []).some((t) => t.segment_id === segmentFilter),
    );
  }, [rows, segmentFilter]);

  const pendingReview = useMemo(
    () => (isManager ? rows.filter((r) => r.approval_status === "submitted") : []),
    [rows, isManager],
  );

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t("notSignedIn"));
      const { error } = await supabase
        .from("customer_interactions")
        .update({
          approval_status: status,
          reviewed_by: u.user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("toastReviewed"));
      setReviewId(null);
      setReviewNotes("");
      await qc.invalidateQueries({ queryKey: ["customer_interactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportExcel = () => {
    const headers = [
      t("export.columns.date"),
      t("export.columns.customer"),
      t("export.columns.phone"),
      t("export.columns.email"),
      t("export.columns.segment"),
      t("export.columns.purchase"),
      t("export.columns.items"),
      t("export.columns.stockOk"),
      t("export.columns.primaryInterest"),
      t("export.columns.internalNotes"),
      t("export.columns.feedback"),
      t("export.columns.alternative"),
      t("export.columns.followUpStock"),
      t("export.columns.marketingTags"),
      t("export.columns.status"),
      t("export.columns.loggedBy"),
    ];
    const data = filtered.map((r) => [
      r.interaction_date,
      r.customer_name,
      r.contact_phone ?? "",
      r.contact_email ?? "",
      segmentLabel(r.customer_segment),
      r.made_purchase ? t("yes") : t("no"),
      purchasedSummary(r),
      yesNo(r.stock_sufficient),
      r.primary_product_notes ?? "",
      r.internal_notes ?? "",
      r.feedback_concerns ?? "",
      r.alternative_offered == null ? "" : yesNo(r.alternative_offered),
      r.follow_up_back_in_stock == null ? "" : yesNo(r.follow_up_back_in_stock),
      segmentNames(r),
      approvalStatusLabel(r.approval_status),
      Array.isArray(r.profiles) ? (r.profiles[0]?.display_name ?? "") : (r.profiles?.display_name ?? ""),
    ]);
    downloadXlsx(t("export.sheetName"), headers, data, `interactions-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CustomerInteraction) => {
    if (row.user_id !== userId && !isManager) return;
    if (row.approval_status === "approved" && !isManager) {
      toast.error(t("cannotEditApproved"));
      return;
    }
    setEditing(row);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={exportExcel}>
            <Download className="mr-2 size-4" />
            {t("exportExcel")}
          </Button>
          <Button type="button" className="rounded-xl" onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            {t("logInteraction")}
          </Button>
        </div>
      </div>

      {isManager && pendingReview.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("pendingReviewTitle", { count: pendingReview.length })}</CardTitle>
            <CardDescription>{t("pendingReviewDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingReview.slice(0, 5).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background px-3 py-2">
                <div>
                  <p className="font-medium">{r.customer_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.interaction_date} · {segmentLabel(r.customer_segment)} ·{" "}
                    {r.made_purchase ? t("purchased") : t("noPurchase")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => {
                      setReviewId(r.id);
                      setReviewNotes("");
                    }}
                  >
                    {t("review")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>{t("filterStatus")}</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
                <SelectTrigger className="w-40 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterAll")}</SelectItem>
                  <SelectItem value="draft">{t("statusDraft")}</SelectItem>
                  <SelectItem value="submitted">{t("statusSubmitted")}</SelectItem>
                  <SelectItem value="approved">{t("statusApproved")}</SelectItem>
                  <SelectItem value="rejected">{t("statusRejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("filterSegment")}</Label>
              <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v ?? "all")}>
                <SelectTrigger className="w-48 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterAll")}</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colDate")}</TableHead>
                    <TableHead>{t("colCustomer")}</TableHead>
                    <TableHead>{t("colSegment")}</TableHead>
                    <TableHead>{t("colPurchase")}</TableHead>
                    <TableHead>{t("colItems")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.interaction_date}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customer_name}</div>
                        <div className="text-muted-foreground text-xs">
                          {[r.contact_phone, r.contact_email].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell>{segmentLabel(r.customer_segment)}</TableCell>
                      <TableCell>{r.made_purchase ? t("yes") : t("no")}</TableCell>
                      <TableCell className="max-w-[12rem] truncate text-sm">{purchasedSummary(r)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full">
                          {approvalStatusLabel(r.approval_status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" className="rounded-lg" onClick={() => openEdit(r)}>
                          <Pencil className="size-4" />
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

      <InteractionFormDialog open={formOpen} onOpenChange={setFormOpen} userId={userId} editing={editing} />

      {reviewId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md rounded-2xl">
            <CardHeader>
              <CardTitle>{t("reviewDialogTitle")}</CardTitle>
              <CardDescription>{t("reviewDialogDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                className="rounded-xl"
                placeholder={t("reviewNotesPlaceholder")}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setReviewId(null)}>
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: reviewId, status: "rejected" })}
                >
                  <X className="mr-1 size-4" />
                  {t("reject")}
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: reviewId, status: "approved" })}
                >
                  <Check className="mr-1 size-4" />
                  {t("approve")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
