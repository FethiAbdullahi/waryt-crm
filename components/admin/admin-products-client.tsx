"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRODUCT_CATEGORIES } from "@/lib/customer-interactions/constants";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";
import { productFormSchema, type ProductFormValues } from "@/lib/validators/interactions";

const supabase = createBrowserSupabaseClient();

const CATEGORY_I18N: Record<(typeof PRODUCT_CATEGORIES)[number], string> = {
  "Living room": "livingRoom",
  Bedroom: "bedroom",
  Dining: "dining",
  Office: "office",
  Outdoor: "outdoor",
  Storage: "storage",
  Decor: "decor",
  Other: "other",
};

export function AdminProductsClient() {
  const t = useTranslations("admin.products");
  const qc = useQueryClient();

  const categoryLabel = (c: string) => {
    const key = CATEGORY_I18N[c as (typeof PRODUCT_CATEGORIES)[number]];
    return key ? t(`categories.${key}` as "categories.livingRoom") : c;
  };
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      name: "",
      category: "Living room",
      stock_quantity: 0,
      is_in_stock: true,
      active: true,
      sort_order: 100,
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const { error } = await supabase.from("products").insert({
        name: values.name.trim(),
        category: values.category.trim() || null,
        stock_quantity: values.stock_quantity,
        is_in_stock: values.is_in_stock,
        active: values.active,
        sort_order: values.sort_order,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("toastAdded"));
      form.reset();
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, patch: p }: { id: string; patch: Partial<Product> }) => {
      const { error } = await supabase.from("products").update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">{t("subtitle")}</p>
      </header>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{t('addTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('name')}</Label>
              <Input className="rounded-xl" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label>{t('category')}</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) => form.setValue("category", v ?? "Living room")}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={categoryLabel(c)} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('stockQuantity')}</Label>
              <Input type="number" min={0} className="rounded-xl" {...form.register("stock_quantity")} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.watch("is_in_stock")} onCheckedChange={(v) => form.setValue("is_in_stock", v)} />
              <Label>{t('inStock')}</Label>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.watch("active")} onCheckedChange={(v) => form.setValue("active", v)} />
              <Label>{t('activeInCatalog')}</Label>
            </div>
            <Button type="submit" className="rounded-xl sm:col-span-2" disabled={save.isPending}>
              {save.isPending ? t("saving") : t("addProduct")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{t('catalogTitle')}</CardTitle>
          <CardDescription>{t('catalogDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead>{t('qty')}</TableHead>
                  <TableHead>{t('inStock')}</TableHead>
                  <TableHead>{t('active')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category ? categoryLabel(p.category) : "—"}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-24 rounded-lg"
                        defaultValue={p.stock_quantity}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n !== p.stock_quantity) {
                            patch.mutate({ id: p.id, patch: { stock_quantity: n } });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_in_stock}
                        onCheckedChange={(v) => patch.mutate({ id: p.id, patch: { is_in_stock: v } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.active}
                        onCheckedChange={(v) => patch.mutate({ id: p.id, patch: { active: v } })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
