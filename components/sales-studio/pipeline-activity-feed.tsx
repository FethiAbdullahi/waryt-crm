"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const supabase = createBrowserSupabaseClient();

type Rel<T> = T | T[] | null | undefined;

function prospectBusinessName(rel: Rel<{ business_name?: string | null }>, accountLabel: string): string {
  if (!rel) return accountLabel;
  const o = Array.isArray(rel) ? rel[0] : rel;
  return o?.business_name?.trim() || accountLabel;
}

export type PipelineActivityFeedRow = {
  id: string;
  channel: string;
  body: string;
  created_at: string;
  studio_prospects?: Rel<{ business_name?: string | null }>;
};

export function PipelineActivityFeed({
  title,
  description,
  compact = false,
}: {
  title?: string;
  description?: string;
  /** Tighter layout when nested on Sales desk. */
  compact?: boolean;
}) {
  const t = useTranslations("studioPanels.pipelineActivity");
  const tChannel = useTranslations("studioPanels.pipelineActivity.channel");
  const titleText = title ?? t("title");
  const descriptionText = description ?? t("description");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["studio", "activity-feed"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) return [];
      const { data, error } = await supabase
        .from("studio_activities")
        .select("id,channel,body,created_at,studio_prospects(business_name)")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(compact ? 20 : 40);
      if (error) throw error;
      return (data ?? []) as PipelineActivityFeedRow[];
    },
  });

  return (
    <Card className={compact ? "border-border/80 shadow-sm" : ""}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <div className="flex items-start gap-2">
          <span className="bg-primary/10 text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl">
            <MessageSquareText className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle className={compact ? "text-base" : "text-lg"}>{titleText}</CardTitle>
            <CardDescription className={compact ? "text-xs" : undefined}>{descriptionText}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? "pt-0" : undefined}>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {rows.map((a) => (
              <li key={a.id} className="space-y-1.5 px-3 py-3 first:rounded-t-xl last:rounded-b-xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {prospectBusinessName(a.studio_prospects, t("account"))}
                  </span>
                  <span aria-hidden>·</span>
                  <Badge variant="secondary" className="rounded-full font-normal">
                    {tChannel.has(a.channel) ? tChannel(a.channel) : a.channel}
                  </Badge>
                  <span aria-hidden>·</span>
                  <time dateTime={a.created_at}>{format(new Date(a.created_at), "MMM d, yyyy · HH:mm")}</time>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
