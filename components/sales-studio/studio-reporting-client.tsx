"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { canAccessManagerRoutes } from "@/lib/roles";
import { studioProspectsQueryKey } from "@/lib/sales-studio/query-keys";
import { labelStage } from "@/lib/sales-studio/routes";
import type { StudioInsight, StudioProspect, UserRole } from "@/lib/types";

const supabase = createBrowserSupabaseClient();

export function StudioReportingClient({ userId, role }: { userId: string; role: UserRole }) {
  const t = useTranslations("studioPanels.reporting");
  const tProspects = useTranslations("studioPanels.prospects");
  const orgScope = canAccessManagerRoutes(role);
  const { data: prospects = [] } = useQuery({
    queryKey: studioProspectsQueryKey(userId),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("studio_prospects").select("*");
      if (error) throw error;
      return (data ?? []) as StudioProspect[];
    },
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["studio", "insights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("studio_insights").select("*").limit(200);
      if (error) throw error;
      return (data ?? []) as StudioInsight[];
    },
  });

  const scopedProspects = orgScope ? prospects : prospects.filter((p) => p.owner_id === userId);
  const byIndustry = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of scopedProspects) {
      const label = p.industry?.trim() || t("unknownIndustry");
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 12);
    const rest = sorted.slice(12).reduce((a, [, n]) => a + n, 0);
    const rows = top.map(([name, count]) => ({
      name: name.length > 22 ? `${name.slice(0, 20)}…` : name,
      count,
    }));
    if (rest > 0) rows.push({ name: t("otherSegments"), count: rest });
    return rows;
  }, [scopedProspects, t]);

  const stageLabel = (stage: string) => {
    const key = `stageOptions.${stage}`;
    return tProspects.has(key) ? tProspects(key) : labelStage(stage);
  };

  const stageMix = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of scopedProspects) {
      m.set(p.stage, (m.get(p.stage) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([stage, count]) => ({ stage, count }));
  }, [scopedProspects]);

  const insightSnippets = (orgScope ? insights : insights.filter((i) => i.user_id === userId)).slice(0, 12);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>
            {orgScope ? t("pipelineByIndustryOrg") : t("pipelineByIndustryYours")}
          </CardTitle>
          <CardDescription>{orgScope ? t("orgDescription") : t("yoursDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {scopedProspects.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("addLeadsHint")}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byIndustry} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={t("accounts")} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("stageMixTitle")}</CardTitle>
            <CardDescription>{orgScope ? t("stageMixOrg") : t("stageMixYours")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stageMix.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noData")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {stageMix.map((s) => (
                  <li key={s.stage} className="flex justify-between gap-2 border-b border-border/50 py-1.5 last:border-0">
                    <span className="font-medium">{stageLabel(s.stage)}</span>
                    <span className="text-muted-foreground tabular-nums">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{orgScope ? t("recentInsightsOrg") : t("recentInsightsYours")}</CardTitle>
            <CardDescription>{orgScope ? t("recentOrgDescription") : t("recentYoursDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {insightSnippets.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("logInsightsHint")}</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {insightSnippets.map((i) => (
                  <li key={i.id} className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
                    <div className="font-medium">{i.title}</div>
                    {i.body ? (
                      <p className="text-muted-foreground mt-1 line-clamp-2">{i.body}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
