"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CUSTOMER_SEGMENTS } from "@/lib/customer-interactions/constants";
import type { CustomerInteraction, Product } from "@/lib/types";
import { interactionFormSchema, type InteractionFormValues } from "@/lib/validators/interactions";

const supabase = createBrowserSupabaseClient();

function defaultValues(row?: CustomerInteraction | null): InteractionFormValues {
  return {
    prospect_id: row?.prospect_id ?? null,
    interaction_date: row?.interaction_date ?? format(new Date(), "yyyy-MM-dd"),
    customer_name: row?.customer_name ?? "",
    contact_phone: row?.contact_phone ?? "",
    contact_email: row?.contact_email ?? "",
    customer_segment: row?.customer_segment === "b2b" ? "b2b" : "b2c",
    made_purchase: row?.made_purchase ?? false,
    primary_product_id: row?.primary_product_id ?? null,
    primary_product_notes: row?.primary_product_notes ?? "",
    stock_sufficient: row?.stock_sufficient ?? null,
    internal_notes: row?.internal_notes ?? "",
    feedback_concerns: row?.feedback_concerns ?? "",
    alternative_offered: row?.alternative_offered ?? null,
    alternative_description: row?.alternative_description ?? "",
    follow_up_back_in_stock: row?.follow_up_back_in_stock ?? null,
    follow_up_product_id: row?.follow_up_product_id ?? null,
    follow_up_notes: row?.follow_up_notes ?? "",
    segment_ids: row?.interaction_segment_tags?.map((t) => t.segment_id) ?? [],
    purchased_items:
      row?.interaction_purchased_items?.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: Number(i.quantity),
      })) ?? [],
    approval_status: "submitted",
  };
}

function YesNoSelect({
  value,
  onChange,
  yesLabel,
  noLabel,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
  yesLabel: string;
  noLabel: string;
}) {
  return (
    <Select
      value={value === null || value === undefined ? "__unset__" : value ? "yes" : "no"}
      onValueChange={(v) => onChange(v === "yes" ? true : v === "no" ? false : null)}
    >
      <SelectTrigger className="w-28 rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">{yesLabel}</SelectItem>
        <SelectItem value="no">{noLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function InteractionFormDialog({
  open,
  onOpenChange,
  userId,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  editing: CustomerInteraction | null;
}) {
  const t = useTranslations("interactions");
  const qc = useQueryClient();
  const [debouncedPhone, setDebouncedPhone] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");

  const form = useForm<InteractionFormValues>({
    resolver: zodResolver(interactionFormSchema) as Resolver<InteractionFormValues>,
    defaultValues: defaultValues(null),
  });

  const madePurchase = form.watch("made_purchase");
  const altOffered = form.watch("alternative_offered");
  const followUp = form.watch("follow_up_back_in_stock");
  const selectedSegments = form.watch("segment_ids");
  const phone = form.watch("contact_phone");
  const email = form.watch("contact_email");
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "purchased_items" });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues(editing));
  }, [open, editing, form]);

  useEffect(() => {
    const tmr = window.setTimeout(() => setDebouncedPhone(phone?.trim() ?? ""), 400);
    return () => window.clearTimeout(tmr);
  }, [phone]);

  useEffect(() => {
    const tmr = window.setTimeout(() => setDebouncedEmail(email?.trim() ?? ""), 400);
    return () => window.clearTimeout(tmr);
  }, [email]);

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: segments = [] } = useQuery({
    queryKey: ["marketing_segments"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_segments")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: prospects = [] } = useQuery({
    queryKey: ["studio_prospects", "interaction-form", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_prospects")
        .select("id,business_name,contact_name,contact_phone,contact_email")
        .order("business_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dupRows = [] } = useQuery({
    queryKey: ["interaction_contact_duplicates", debouncedPhone, debouncedEmail, editing?.id],
    enabled: open && (debouncedPhone.length >= 6 || debouncedEmail.includes("@")),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("interaction_contact_duplicates", {
        p_phone: debouncedPhone || null,
        p_email: debouncedEmail || null,
        p_exclude_interaction_id: editing?.id ?? null,
      });
      if (error) throw error;
      return (data ?? []) as { source: string; customer_name: string; owner_display_name: string }[];
    },
  });

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name, inStock: p.is_in_stock })),
    [products],
  );

  const persist = async (values: InteractionFormValues) => {
    const payload = {
      user_id: userId,
      prospect_id: values.prospect_id || null,
      interaction_date: values.interaction_date,
      customer_name: values.customer_name.trim(),
      contact_phone: values.contact_phone.trim() || null,
      contact_email: values.contact_email.trim() || null,
      customer_segment: values.customer_segment,
      made_purchase: values.made_purchase,
      primary_product_id: values.primary_product_id || null,
      primary_product_notes: values.primary_product_notes.trim() || null,
      stock_sufficient: values.made_purchase ? (values.stock_sufficient ?? null) : null,
      internal_notes: values.internal_notes.trim() || null,
      feedback_concerns: values.feedback_concerns.trim() || null,
      alternative_offered: values.made_purchase ? null : (values.alternative_offered ?? null),
      alternative_description: values.made_purchase ? null : values.alternative_description.trim() || null,
      follow_up_back_in_stock: values.made_purchase ? null : (values.follow_up_back_in_stock ?? null),
      follow_up_product_id:
        values.made_purchase || !values.follow_up_back_in_stock ? null : values.follow_up_product_id || null,
      follow_up_notes:
        values.made_purchase || !values.follow_up_back_in_stock ? null : values.follow_up_notes.trim() || null,
      approval_status: values.approval_status,
    };

    let interactionId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("customer_interactions").update(payload).eq("id", editing.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("customer_interactions").insert(payload).select("id").single();
      if (error) throw error;
      interactionId = data.id as string;
    }
    if (!interactionId) throw new Error("Missing interaction id");

    await supabase.from("interaction_purchased_items").delete().eq("interaction_id", interactionId);
    await supabase.from("interaction_segment_tags").delete().eq("interaction_id", interactionId);

    if (values.made_purchase && values.purchased_items.length > 0) {
      const { error: itemsErr } = await supabase.from("interaction_purchased_items").insert(
        values.purchased_items.map((item, idx) => ({
          interaction_id: interactionId,
          product_id: item.product_id || null,
          product_name: item.product_name.trim(),
          quantity: item.quantity,
          sort_order: idx,
        })),
      );
      if (itemsErr) throw itemsErr;
    }

    if (values.segment_ids.length > 0) {
      const { error: tagErr } = await supabase.from("interaction_segment_tags").insert(
        values.segment_ids.map((segment_id) => ({ interaction_id: interactionId, segment_id })),
      );
      if (tagErr) throw tagErr;
    }
  };

  const save = useMutation({
    mutationFn: persist,
    onSuccess: async () => {
      toast.success(editing ? t("toastUpdated") : t("toastCreated"));
      await qc.invalidateQueries({ queryKey: ["customer_interactions"] });
      await qc.invalidateQueries({ queryKey: ["studio", "alerts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onProspectPick = (prospectId: string | null) => {
    if (!prospectId || prospectId === "__none__") {
      form.setValue("prospect_id", null);
      return;
    }
    const p = prospects.find((x) => x.id === prospectId);
    if (!p) return;
    form.setValue("prospect_id", prospectId);
    form.setValue("customer_name", p.business_name ?? p.contact_name ?? "");
    if (p.contact_phone) form.setValue("contact_phone", p.contact_phone);
    if (p.contact_email) form.setValue("contact_email", p.contact_email);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,52rem)] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("newTitle")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <DatePickerField
            id="ci-date"
            label={t("fields.date")}
            value={form.watch("interaction_date")}
            onChange={(v) => form.setValue("interaction_date", v)}
          />

          <div className="space-y-2">
            <Label>{t("fields.customerSegment")}</Label>
            <Controller
              control={form.control}
              name="customer_segment"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "b2b" ? t("segmentB2b") : t("segmentB2c")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("fields.linkProspect")}</Label>
            <Select value={form.watch("prospect_id") ?? "__none__"} onValueChange={onProspectPick}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={t("fields.linkProspectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("fields.noProspect")}</SelectItem>
                {prospects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ci-name">{t("fields.customerName")}</Label>
            <Input id="ci-name" className="rounded-xl" {...form.register("customer_name")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ci-phone">{t("fields.phone")}</Label>
              <Input id="ci-phone" className="rounded-xl" {...form.register("contact_phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-email">{t("fields.email")}</Label>
              <Input id="ci-email" type="email" className="rounded-xl" {...form.register("contact_email")} />
            </div>
          </div>

          {dupRows.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">{t("duplicateWarning")}</p>
              <ul className="text-muted-foreground mt-1 space-y-1 text-xs">
                {dupRows.slice(0, 5).map((d, i) => (
                  <li key={`${d.source}-${i}`}>
                    {d.customer_name} ({d.source === "interaction" ? t("duplicateSource.interaction") : d.source === "prospect" ? t("duplicateSource.prospect") : d.source}) — {d.owner_display_name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
            <Label htmlFor="made-purchase">{t("fields.madePurchaseToday")}</Label>
            <Switch
              id="made-purchase"
              checked={madePurchase}
              onCheckedChange={(v) => {
                form.setValue("made_purchase", v);
                if (v && fields.length === 0) append({ product_id: null, product_name: "", quantity: 1 });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("fields.primaryInterest")}</Label>
            <Controller
              control={form.control}
              name="primary_product_id"
              render={({ field }) => (
                <Select value={field.value ?? "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={t("fields.primaryInterestPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("fields.otherProduct")}</SelectItem>
                    {productOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {!p.inStock ? ` (${t("outOfStock")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Input className="rounded-xl" placeholder={t("fields.primaryInterestNotes")} {...form.register("primary_product_notes")} />
          </div>

          {madePurchase ? (
            <div className="space-y-3 rounded-xl border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <Label>{t("fields.itemsPurchased")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => append({ product_id: null, product_name: "", quantity: 1 })}
                >
                  <Plus className="mr-1 size-3.5" />
                  {t("addItem")}
                </Button>
              </div>
              {fields.map((field, index) => (
                <PurchasedItemRow
                  key={field.id}
                  index={index}
                  form={form}
                  productOptions={productOptions}
                  onRemove={() => remove(index)}
                  t={t}
                />
              ))}
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <Label>{t("fields.stockSufficient")}</Label>
                <Controller
                  control={form.control}
                  name="stock_sufficient"
                  render={({ field }) => (
                    <YesNoSelect value={field.value} onChange={field.onChange} yesLabel={t("yes")} noLabel={t("no")} />
                  )}
                />
              </div>
            </div>
          ) : (
            <NoPurchaseFields form={form} productOptions={productOptions} altOffered={altOffered} followUp={followUp} t={t} />
          )}

          <div className="space-y-2">
            <Label>{t("fields.internalNotes")}</Label>
            <Textarea className="rounded-xl" rows={3} {...form.register("internal_notes")} />
          </div>
          <div className="space-y-2">
            <Label>{t("fields.feedbackConcerns")}</Label>
            <Textarea className="rounded-xl" rows={2} {...form.register("feedback_concerns")} />
          </div>

          {segments.length > 0 ? (
            <div className="space-y-2">
              <Label>{t("fields.marketingSegments")}</Label>
              <p className="text-muted-foreground text-xs">{t("fields.marketingSegmentsHint")}</p>
              <div className="flex flex-wrap gap-2">
                {segments.map((s) => (
                  <Badge
                    key={s.id}
                    variant={selectedSegments.includes(s.id) ? "default" : "outline"}
                    className="cursor-pointer rounded-full"
                    onClick={() => {
                      const set = new Set(selectedSegments);
                      if (set.has(s.id)) set.delete(s.id);
                      else set.add(s.id);
                      form.setValue("segment_ids", [...set]);
                    }}
                  >
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={save.isPending}
              onClick={() => {
                form.setValue("approval_status", "draft");
                void form.handleSubmit((v) => save.mutate(v))();
              }}
            >
              {t("saveDraft")}
            </Button>
            <Button type="submit" className="rounded-xl" disabled={save.isPending}>
              {save.isPending ? t("saving") : t("submitForReview")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchasedItemRow({
  index,
  form,
  productOptions,
  onRemove,
  t,
}: {
  index: number;
  form: ReturnType<typeof useForm<InteractionFormValues>>;
  productOptions: { id: string; name: string }[];
  onRemove: () => void;
  t: ReturnType<typeof useTranslations<"interactions">>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_5rem_auto]">
      <Controller
        control={form.control}
        name={`purchased_items.${index}.product_id`}
        render={({ field: f }) => (
          <Select
            value={f.value ?? "__custom__"}
            onValueChange={(v) => {
              if (v === "__custom__") {
                f.onChange(null);
                return;
              }
              f.onChange(v);
              const prod = productOptions.find((p) => p.id === v);
              if (prod) form.setValue(`purchased_items.${index}.product_name`, prod.name);
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder={t("fields.product")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__custom__">{t("fields.customProduct")}</SelectItem>
              {productOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <Input
        type="number"
        min={0.01}
        step="1"
        className="rounded-xl"
        {...form.register(`purchased_items.${index}.quantity`, { valueAsNumber: true })}
      />
      <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
      <Input
        className="rounded-xl sm:col-span-3"
        placeholder={t("fields.productName")}
        {...form.register(`purchased_items.${index}.product_name`)}
      />
    </div>
  );
}

function NoPurchaseFields({
  form,
  productOptions,
  altOffered,
  followUp,
  t,
}: {
  form: ReturnType<typeof useForm<InteractionFormValues>>;
  productOptions: { id: string; name: string }[];
  altOffered: boolean | null | undefined;
  followUp: boolean | null | undefined;
  t: ReturnType<typeof useTranslations<"interactions">>;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border/70 p-3">
      <p className="text-muted-foreground text-sm font-medium">{t("noPurchaseSection")}</p>
      <div className="flex items-center justify-between">
        <Label>{t("fields.alternativeOffered")}</Label>
        <Controller
          control={form.control}
          name="alternative_offered"
          render={({ field }) => (
            <YesNoSelect value={field.value} onChange={field.onChange} yesLabel={t("yes")} noLabel={t("no")} />
          )}
        />
      </div>
      {altOffered ? (
        <Textarea
          className="rounded-xl"
          placeholder={t("fields.alternativeDescription")}
          {...form.register("alternative_description")}
        />
      ) : null}
      <div className="flex items-center justify-between">
        <Label>{t("fields.followUpBackInStock")}</Label>
        <Controller
          control={form.control}
          name="follow_up_back_in_stock"
          render={({ field }) => (
            <YesNoSelect value={field.value} onChange={field.onChange} yesLabel={t("yes")} noLabel={t("no")} />
          )}
        />
      </div>
      {followUp ? (
        <>
          <Controller
            control={form.control}
            name="follow_up_product_id"
            render={({ field }) => (
              <Select
                value={field.value ?? "__none__"}
                onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("fields.followUpProduct")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("fields.otherProduct")}</SelectItem>
                  {productOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Textarea
            className="rounded-xl"
            placeholder={t("fields.followUpNotes")}
            {...form.register("follow_up_notes")}
          />
        </>
      ) : null}
    </div>
  );
}
