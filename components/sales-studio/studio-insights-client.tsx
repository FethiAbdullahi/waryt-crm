"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineActivityFeed } from "@/components/sales-studio/pipeline-activity-feed";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { labelInsightCategory, STUDIO_INSIGHT_CATEGORIES } from "@/lib/sales-studio/routes";
import type { StudioInsight } from "@/lib/types";
import { studioInsightSchema, type StudioInsightValues } from "@/lib/validators/studio";

const supabase = createBrowserSupabaseClient();

export function StudioInsightsClient() {
  const qc = useQueryClient();
  const t = useTranslations("studioPanels.insights");
  const form = useForm<StudioInsightValues>({
    resolver: zodResolver(studioInsightSchema),
    defaultValues: {
      category: "objection",
      title: "",
      body: "",
      is_shared: false,
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["studio", "insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as StudioInsight[];
    },
  });

  const insert = useMutation({
    mutationFn: async (values: StudioInsightValues) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("studio_insights").insert({
        user_id: u.user.id,
        category: values.category,
        title: values.title.trim(),
        body: values.body?.trim() ? values.body.trim() : null,
        is_shared: values.is_shared,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["studio", "insights"] });
      toast.success(t("insightSavedToast"));
      form.reset({ category: "objection", title: "", body: "", is_shared: false });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <PipelineActivityFeed
        title={t("pipelineTouchpointsTitle")}
        description={t("pipelineTouchpointsDescription")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("logInsightTitle")}</CardTitle>
          <CardDescription>{t("logInsightDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => insert.mutate(v))}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STUDIO_INSIGHT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {labelInsightCategory(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex items-end justify-between gap-2 rounded-xl border border-border/80 px-3 py-2">
                <Label htmlFor="ins-share" className="cursor-pointer text-sm">
                  {t("shareToggle")}
                </Label>
                <Controller
                  control={form.control}
                  name="is_shared"
                  render={({ field }) => (
                    <Switch id="ins-share" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ins-title">{t("title")}</Label>
              <Input id="ins-title" className="rounded-xl" {...form.register("title")} />
              {form.formState.errors.title ? (
                <p className="text-destructive text-sm">{form.formState.errors.title.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ins-body">{t("detail")}</Label>
              <Textarea id="ins-body" rows={3} className="rounded-xl" {...form.register("body")} />
            </div>
            <Button type="submit" className="rounded-xl" disabled={insert.isPending}>
              {insert.isPending ? t("saving") : t("saveInsight")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("yourLogTitle")}</CardTitle>
          <CardDescription>{t("yourLogDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noInsights")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("when")}</TableHead>
                    <TableHead>{t("category")}</TableHead>
                    <TableHead>{t("title")}</TableHead>
                    <TableHead>{t("shared")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                        {format(new Date(r.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full font-normal">
                          {labelInsightCategory(r.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        {r.body ? (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{r.body}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>{r.is_shared ? t("yes") : t("dash")}</TableCell>
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
